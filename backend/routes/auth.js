const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { Op } = require('sequelize');
const { sequelize, User, Beneficiary, Barangay, Otp } = require('../db');
const { sendSms } = require('../services/smsService');

const router = express.Router();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

function getActiveLoginLock(user) {
  if (!user?.login_locked_until) return null;
  const lockedUntil = new Date(user.login_locked_until);
  return lockedUntil > new Date() ? lockedUntil : null;
}

async function clearExpiredLoginLock(user) {
  if (user?.login_locked_until && !getActiveLoginLock(user)) {
    await user.update({ failed_login_attempts: 0, login_locked_until: null });
  }
}

function loginLockResponse(lockedUntil) {
  const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
  return {
    success: false,
    message: `Nasuspinde muna ang pag-login dahil sa 5 maling pagtatangka. Subukan muli pagkalipas ng ${Math.ceil(retryAfterSeconds / 60)} minuto.`,
    locked_until: lockedUntil.toISOString(),
    retry_after_seconds: retryAfterSeconds,
  };
}

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Nodemailer transporter (configured via env vars)
let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ─── Generate 6-digit OTP ───
function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

function normalizePhilippineMobile(value) {
  const raw = String(value || '').replace(/[\s()-]/g, '');
  if (/^09\d{9}$/.test(raw)) return `+63${raw.slice(1)}`;
  if (/^\+639\d{9}$/.test(raw)) return raw;
  if (/^639\d{9}$/.test(raw)) return `+${raw}`;
  return null;
}

router.post('/send-mobile-otp', async (req, res, next) => {
  try {
    const contactNumber = normalizePhilippineMobile(req.body.contact_number);
    if (!contactNumber) return res.status(400).json({ success: false, message: 'Maglagay ng valid na Philippine mobile number (hal. 0917xxxxxxx).' });
    await Otp.update({ verified: true }, { where: { contact_number: contactNumber, verified: false } });
    const otpCode = generateOtp();
    const otpRecord = await Otp.create({ contact_number: contactNumber, otp_code: otpCode, expires_at: new Date(Date.now() + 5 * 60 * 1000), verified: false });
    let sent = false;
    try {
      await sendSms(contactNumber, `BeniAid DSWD Bongabong verification code: ${otpCode}. Expires in 5 minutes.`);
      sent = true;
    } catch (smsError) {
      console.error('[MOBILE OTP] SMS send failed:', smsError.message);
    }
    if (!sent) {
      await otpRecord.update({ verified: true });
      return res.status(503).json({
        success: false,
        message: 'Hindi naipadala ang OTP. Pakisuri ang PhilSMS setup at subukan muli.',
      });
    }
    return res.json({ success: true, message: 'OTP sent to your mobile number.' });
  } catch (error) { next(error); }
});

router.post('/verify-mobile-otp', async (req, res, next) => {
  try {
    const contactNumber = normalizePhilippineMobile(req.body.contact_number);
    const otp = String(req.body.otp || '').trim();
    if (!contactNumber || !/^\d{6}$/.test(otp)) return res.status(400).json({ success: false, message: 'Mobile number and 6-digit OTP are required.' });
    const otpRecord = await Otp.findOne({ where: { contact_number: contactNumber, otp_code: otp, verified: false }, order: [['created_at', 'DESC']] });
    if (!otpRecord) return res.status(400).json({ success: false, message: 'Invalid OTP code.' });
    if (new Date() > new Date(otpRecord.expires_at)) return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    otpRecord.verified = true;
    await otpRecord.save();
    const otpToken = jwt.sign({ contact_number: contactNumber, mobile_otp_verified: true }, process.env.JWT_SECRET, { expiresIn: '10m' });
    return res.json({ success: true, otp_token: otpToken });
  } catch (error) { next(error); }
});

// ─── POST /api/auth/send-otp ───
router.post('/send-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Invalidate any previous OTPs for this email
    await Otp.update({ verified: true }, { where: { email, verified: false } });

    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await Otp.create({
      email,
      otp_code: otpCode,
      expires_at: expiresAt,
      verified: false,
    });

    // Try to send via email, fallback to returning OTP in dev mode
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"BeniAid DSWD Bongabong" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'BeniAid DSWD Bongabong - Your Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
              <h2 style="color: #0038A8; margin-bottom: 8px;">BeniAid DSWD Bongabong Verification Code</h2>
              <p style="color: #475569; margin-bottom: 24px;">Use the following code to verify your email address. This code expires in 5 minutes.</p>
              <div style="background: #0038A8; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 16px 32px; border-radius: 8px; letter-spacing: 8px; margin-bottom: 24px;">
                ${otpCode}
              </div>
              <p style="color: #94a3b8; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
            </div>
          `,
        });
        return res.json({ success: true, message: 'OTP sent to your email' });
      } catch (emailErr) {
        console.error('[OTP] Email send failed:', emailErr.message);
        // Fall through to dev mode response
      }
    }

    // Dev mode: return OTP in response (no email configured)
    console.log(`[OTP] Code for ${email}: ${otpCode}`);
    return res.json({
      success: true,
      message: 'OTP generated (dev mode - check response)',
      dev_otp: otpCode,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/verify-otp ───
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const otpRecord = await Otp.findOne({
      where: { email, otp_code: otp, verified: false },
      order: [['created_at', 'DESC']],
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }

    if (new Date() > new Date(otpRecord.expires_at)) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one' });
    }

    // Mark as verified
    otpRecord.verified = true;
    await otpRecord.save();

    // Generate a short-lived token to prove OTP was verified
    const otpToken = jwt.sign(
      { email, otp_verified: true },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.json({ success: true, message: 'OTP verified successfully', otp_token: otpToken });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/forgot-password/send-otp ───
router.post('/forgot-password/send-otp', async (req, res, next) => {
  try {
    const method = String(req.body.method || '').trim().toLowerCase();
    const rawIdentifier = String(req.body.identifier || '').trim();
    if (!['email', 'mobile'].includes(method) || !rawIdentifier) {
      return res.status(400).json({ success: false, message: 'Pumili ng recovery method at ilagay ang registered email o mobile number.' });
    }

    if (method === 'email' && !transporter) {
      return res.status(503).json({ success: false, message: 'Hindi pa naka-configure ang email service. Makipag-ugnayan sa administrator.' });
    }

    let user;
    let destination;
    let maskedDestination;
    const otpField = method === 'email' ? 'email' : 'contact_number';

    if (method === 'email') {
      destination = rawIdentifier.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
        return res.status(400).json({ success: false, message: 'Maglagay ng valid na registered email address.' });
      }
      user = await User.findOne({ where: { email: destination } });
      const [namePart, domainPart] = destination.split('@');
      const maskedName = namePart.length > 2
        ? `${namePart[0]}${'*'.repeat(namePart.length - 2)}${namePart.slice(-1)}`
        : `${namePart[0]}*`;
      maskedDestination = `${maskedName}@${domainPart}`;
    } else {
      destination = normalizePhilippineMobile(rawIdentifier);
      if (!destination) {
        return res.status(400).json({ success: false, message: 'Maglagay ng valid na Philippine mobile number (hal. 0917xxxxxxx).' });
      }

      const digits = destination.slice(1);
      const mobileAliases = [destination, digits, `0${digits.slice(2)}`];
      const beneficiary = await Beneficiary.findOne({
        where: { contact_number: { [Op.in]: mobileAliases } },
        include: [{ model: User, required: true, where: { role: 'beneficiary' } }],
      });
      user = beneficiary?.User || null;
      maskedDestination = `+63 ${digits.slice(2, 4)}••••${digits.slice(-4)}`;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: method === 'mobile'
          ? 'Walang beneficiary account na tumutugma sa registered mobile number.'
          : 'Walang account na nakarehistro sa email na iyan.',
      });
    }

    if (method === 'email' && !user.email) {
      return res.status(400).json({ success: false, message: 'Walang registered email address ang account na ito.' });
    }

    await Otp.update({ verified: true }, { where: { [otpField]: destination, verified: false } });
    const otpCode = generateOtp();
    const otpRecord = await Otp.create({
      [otpField]: destination,
      otp_code: otpCode,
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
      verified: false,
    });

    try {
      if (method === 'email') {
        await transporter.sendMail({
          from: `"BeniAid DSWD Bongabong" <${process.env.SMTP_USER}>`,
          to: destination,
          subject: 'BeniAid DSWD Bongabong - Password Reset Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
              <h2 style="color: #0038A8; margin-bottom: 8px;">BeniAid DSWD Bongabong Password Reset</h2>
              <p style="color: #475569; margin-bottom: 12px;">Gamitin ang 6-digit verification code na ito. Mag-e-expire ito sa loob ng 10 minuto:</p>
              <div style="background: #0038A8; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 16px 32px; border-radius: 8px; letter-spacing: 8px; margin-bottom: 24px;">${otpCode}</div>
              <p style="color: #94a3b8; font-size: 12px;">Kung hindi mo hiniling ang reset na ito, balewalain ang email na ito.</p>
            </div>
          `,
        });
      } else {
        await sendSms(destination, `BeniAid DSWD Bongabong password reset code: ${otpCode}. Expires in 10 minutes.`);
      }
    } catch (deliveryError) {
      await otpRecord.update({ verified: true });
      console.error(`[FORGOT-PASSWORD] ${method} delivery failed:`, deliveryError.message);
      return res.status(503).json({
        success: false,
        message: method === 'mobile'
          ? 'Hindi naipadala ang SMS code. Pakisuri ang SMS service at subukan muli.'
          : 'Hindi naipadala ang email code. Pakisuri ang email service at subukan muli.',
      });
    }

    const recoveryToken = jwt.sign({
      purpose: 'forgot_password',
      user_id: user.id,
      method,
      destination,
    }, process.env.JWT_SECRET, { expiresIn: '10m' });

    return res.json({
      success: true,
      message: `Naipadala ang verification code sa ${maskedDestination}.`,
      masked_destination: maskedDestination,
      recovery_token: recoveryToken,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/forgot-password/reset ───
router.post('/forgot-password/reset', async (req, res, next) => {
  try {
    const { recovery_token, otp, new_password } = req.body;
    const otpCode = String(otp || '').trim();
    if (!recovery_token || !/^\d{6}$/.test(otpCode) || !new_password) {
      return res.status(400).json({ success: false, message: 'Recovery token, 6-digit code, at bagong password ay kinakailangan.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Ang password ay dapat hindi bababa sa 6 characters.' });
    }

    let challenge;
    try {
      challenge = jwt.verify(recovery_token, process.env.JWT_SECRET);
    } catch (tokenError) {
      return res.status(400).json({ success: false, message: 'Nag-expire o invalid ang recovery request. Humingi ng bagong verification code.' });
    }
    if (challenge.purpose !== 'forgot_password' || !['email', 'mobile'].includes(challenge.method) || !challenge.user_id || !challenge.destination) {
      return res.status(400).json({ success: false, message: 'Invalid ang recovery request. Humingi ng bagong verification code.' });
    }

    const otpField = challenge.method === 'email' ? 'email' : 'contact_number';
    const otpRecord = await Otp.findOne({
      where: { [otpField]: challenge.destination, otp_code: otpCode, verified: false },
      order: [['created_at', 'DESC']],
    });
    if (!otpRecord || new Date() > new Date(otpRecord.expires_at)) {
      return res.status(400).json({ success: false, message: 'Mali o expired na ang verification code. Humingi ng bagong code.' });
    }

    const user = await User.findByPk(challenge.user_id);
    if (!user) return res.status(404).json({ success: false, message: 'Hindi na makita ang account na ito.' });

    user.password = new_password;
    user.failed_login_attempts = 0;
    user.login_locked_until = null;
    await user.save();
    await otpRecord.update({ verified: true });

    return res.json({
      success: true,
      message: 'Matagumpay na napalitan ang iyong password! Maaari ka nang mag-sign in.',
      login_identifier: user.username || user.email || '',
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/google ───
router.post('/google', async (req, res, next) => {
  try {
    console.log('[Google Auth] Request received');
    const { credential } = req.body;
    if (!credential) {
      console.error('[Google Auth] No credential provided');
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }

    console.log('[Google Auth] Credential received, length:', credential.length);
    console.log('[Google Auth] Using Client ID:', process.env.GOOGLE_CLIENT_ID);

    // Verify the Google ID token
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      console.log('[Google Auth] Token verified successfully');
    } catch (verifyErr) {
      console.error('[Google Auth] Token verification failed:', verifyErr.message);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid Google credential',
        error_detail: verifyErr.message 
      });
    }

    const payload = ticket.getPayload();
    const { email, given_name, family_name, sub: googleId } = payload;
    console.log('[Google Auth] Payload extracted - email:', email, 'name:', given_name, family_name);

    if (!email) {
      console.error('[Google Auth] No email in Google account');
      return res.status(400).json({ success: false, message: 'Google account has no email' });
    }

    // Find existing user by email
    let user = await User.findOne({ where: { email } });
    console.log('[Google Auth] User lookup:', user ? `Found user ID ${user.id}` : 'User not found, creating new');

    if (user) {
      const lockedUntil = getActiveLoginLock(user);
      if (lockedUntil) return res.status(423).json(loginLockResponse(lockedUntil));
      await clearExpiredLoginLock(user);
    }

    const defaultBarangay = await Barangay.findOne({ order: [['id', 'ASC']] });
    const defaultBarangayId = defaultBarangay ? defaultBarangay.id : 1;

    if (!user) {
      // Auto-create beneficiary account for new Google users
      const randomPassword = crypto.randomBytes(32).toString('hex');
      console.log('[Google Auth] Creating new user account...');
      user = await User.create({
        first_name: given_name || 'Google',
        last_name: family_name || 'User',
        email,
        password: randomPassword,
        role: 'beneficiary',
        status: 'active',
      });
      console.log('[Google Auth] User created with ID:', user.id);

      // Create matching Beneficiary record
      console.log('[Google Auth] Creating beneficiary record...');
      await Beneficiary.create({
        user_id: user.id,
        first_name: given_name || 'Google',
        last_name: family_name || 'User',
        sex: 'Other',
        birthdate: '2000-01-01',
        barangay_id: defaultBarangayId,
        category: 'Persons with Disabilities (PWD)',
        ip_classification: 'Non-IP',
        contact_number: '',
        sitio: '',
        address: '',
      });
      console.log('[Google Auth] Beneficiary record created');
    } else if (user.role === 'beneficiary') {
      const existingBen = await Beneficiary.findOne({ where: { user_id: user.id } });
      if (!existingBen) {
        console.log('[Google Auth] Creating missing beneficiary record for existing user ID:', user.id);
        await Beneficiary.create({
          user_id: user.id,
          first_name: user.first_name || given_name || 'Google',
          last_name: user.last_name || family_name || 'User',
          sex: 'Other',
          birthdate: '2000-01-01',
          barangay_id: defaultBarangayId,
          category: 'Persons with Disabilities (PWD)',
          ip_classification: 'Non-IP',
          contact_number: user.phone || '',
          sitio: '',
          address: '',
        });
      }
    }

    console.log('[Google Auth] Generating JWT token for user ID:', user.id);
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });

    console.log('[Google Auth] Login successful for:', email);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        status: user.status,
        inactive_reason: user.inactive_reason,
        barangay_id: user.barangay_id,
      },
    });
  } catch (error) {
    console.error('[Google Auth] Error:', error.message);
    console.error('[Google Auth] Stack:', error.stack);
    next(error);
  }
});

// ─── POST /api/auth/login ───
router.post('/login', async (req, res, next) => {
  try {
    const { email, username, identifier, password } = req.body;
    const rawIdentifier = String(identifier ?? username ?? email ?? '').trim();
    const loginIdentifier = rawIdentifier.includes('@') ? rawIdentifier.toLowerCase() : rawIdentifier;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email and password are required' });
    }

    const aliasMap = { mswdo: 'mswdo_admin', mswdostaff: 'mswdo_staff', senioradmin: 'senior_admin', seniorstaff: 'senior_staff', osca: 'senior_admin', oscastaff: 'senior_staff', pwdadmin: 'pwd_admin', pwdstaff: 'pwd_staff', pwdo: 'pwd_admin', pwdostaff: 'pwd_staff' };
    const resolvedUsername = aliasMap[loginIdentifier.toLowerCase()] || loginIdentifier;
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: loginIdentifier },
          { username: loginIdentifier },
          { username: resolvedUsername },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Hindi nahanap ang account (User not found)' });
    }

    let authenticatedUser = null;
    let loginFailure = null;
    let lockedUntil = null;
    let attemptsRemaining = null;

    await sequelize.transaction(async (transaction) => {
      const account = await User.findByPk(user.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!account) {
        loginFailure = 'missing';
        return;
      }

      const currentLock = getActiveLoginLock(account);
      if (currentLock) {
        loginFailure = 'locked';
        lockedUntil = currentLock;
        return;
      }

      if (account.login_locked_until) {
        await account.update({ failed_login_attempts: 0, login_locked_until: null }, { transaction });
      }

      if (!(await account.comparePassword(password))) {
        const failedAttempts = (Number(account.failed_login_attempts) || 0) + 1;
        if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
          lockedUntil = new Date(Date.now() + LOGIN_LOCK_DURATION_MS);
          await account.update({
            failed_login_attempts: MAX_LOGIN_ATTEMPTS,
            login_locked_until: lockedUntil,
          }, { transaction });
          loginFailure = 'locked';
          return;
        }

        attemptsRemaining = MAX_LOGIN_ATTEMPTS - failedAttempts;
        await account.update({ failed_login_attempts: failedAttempts }, { transaction });
        loginFailure = 'incorrect_password';
        return;
      }

      await account.update({ failed_login_attempts: 0, login_locked_until: null }, { transaction });
      authenticatedUser = account;
    });

    if (loginFailure === 'missing') {
      return res.status(404).json({ success: false, message: 'Hindi na makita ang account na ito.' });
    }
    if (loginFailure === 'locked') {
      return res.status(423).json(loginLockResponse(lockedUntil));
    }
    if (loginFailure === 'incorrect_password') {
      return res.status(401).json({
        success: false,
        message: `Mali ang password. May ${attemptsRemaining} na pagtatangka ka pa bago pansamantalang masuspinde ang pag-login.`,
        attempts_remaining: attemptsRemaining,
      });
    }

    const loginUser = authenticatedUser;

    // Allow login even if inactive, but include status in response
    // Frontend will show appropriate notice based on status

    const token = jwt.sign({ id: loginUser.id, role: loginUser.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });

    res.json({
      success: true,
      token,
      user: {
        id: loginUser.id,
        first_name: loginUser.first_name,
        last_name: loginUser.last_name,
        username: loginUser.username,
        email: loginUser.email,
        role: loginUser.role,
        status: loginUser.status,
        inactive_reason: loginUser.inactive_reason,
        barangay_id: loginUser.barangay_id,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/register-beneficiary ───
router.post('/register-beneficiary', async (req, res, next) => {
  try {
    const {
      first_name,
      last_name,
      username,
      email,
      password,
      barangay_id,
      contact_number,
      sex,
      birthdate,
      category,
      ip_classification,
      sitio,
      address,
      household_id_number,
      otp_token,
    } = req.body;

    const trimmedUsername = username ? String(username).trim() : '';
    const trimmedEmail = email && String(email).trim() !== '' ? String(email).trim().toLowerCase() : null;
    const normalizedContactNumber = normalizePhilippineMobile(contact_number);

    if (!first_name || !last_name || !trimmedUsername || !password || !barangay_id || !normalizedContactNumber) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, username, password, barangay, and a valid mobile number are required',
      });
    }

    if (!otp_token) return res.status(400).json({ success: false, message: 'Mobile OTP verification is required before registration.' });
    try {
      const decoded = jwt.verify(otp_token, process.env.JWT_SECRET);
      if (!decoded.mobile_otp_verified || decoded.contact_number !== normalizedContactNumber) throw new Error('Invalid mobile OTP');
    } catch (jwtErr) {
      return res.status(400).json({ success: false, message: 'Mobile OTP verification has expired. Please verify your number again.' });
    }

    const existingContact = await User.findOne({ where: { contact_number: normalizedContactNumber } });
    if (existingContact) return res.status(409).json({ success: false, message: 'Ang mobile number na ito ay nakarehistro na sa sistema.' });

    if (trimmedUsername.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters long',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    let stdCategory = category || 'Persons with Disabilities (PWD)';
    if (category) {
      const lower = category.toLowerCase();
      if (lower.includes('4ps')) stdCategory = '4Ps Household Beneficiaries';
      else if (lower.includes('senior')) stdCategory = 'Senior Citizens (Social Pension)';
      else if (lower.includes('pwd') || lower.includes('disabil')) stdCategory = 'Persons with Disabilities (PWD)';
    }

    const is4Ps = stdCategory.toLowerCase().includes('4ps');
    const trimmedHh = household_id_number ? String(household_id_number).trim() : null;

    if (is4Ps && !trimmedHh) {
      return res.status(400).json({
        success: false,
        message: 'Household Number is required for 4Ps Household Beneficiaries',
      });
    }

    if (is4Ps && trimmedHh) {
      const existingHh = await Beneficiary.findOne({
        where: {
          [Op.or]: [
            { household_id_number: trimmedHh },
            { beneficiary_id_code: trimmedHh }
          ]
        }
      });
      if (existingHh) {
        return res.status(409).json({
          success: false,
          message: 'Ang 4Ps Household Number na ito ay nakarehistro na sa sistema.',
        });
      }
    }

    // Check if email already exists (if email is provided)
    if (trimmedEmail) {
      const existingEmail = await User.findOne({ where: { email: trimmedEmail } });
      if (existingEmail) {
        return res.status(409).json({ success: false, message: 'Email address is already registered' });
      }
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ where: { username: trimmedUsername } });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: 'Username is already taken. Please choose another username.',
      });
    }

    // Create User record
    const user = await User.create({
      first_name: String(first_name).trim(),
      last_name: String(last_name).trim(),
      username: trimmedUsername,
      email: trimmedEmail,
      password,
      role: 'beneficiary',
      barangay_id: Number(barangay_id),
      contact_number: normalizedContactNumber,
      status: 'active',
    });

    const { Barangay } = require('../db');
    const brgy = await Barangay.findByPk(Number(barangay_id));
    const brgyName = brgy ? brgy.barangay_name : '';
    const computedAddress = address && address.trim() !== ''
      ? address.trim()
      : [sitio ? String(sitio).trim() : null, brgyName ? `Barangay ${brgyName}` : null, 'Bongabong, Oriental Mindoro']
          .filter(Boolean)
          .join(', ');

    // Create corresponding Beneficiary record
    // For 4Ps beneficiaries, their beneficiary number IS their Household Number
    // For Senior and PWD, beneficiary number is standard Beneficiary ID assigned upon approval
    const beneficiary = await Beneficiary.create({
      user_id: user.id,
      first_name: String(first_name).trim(),
      last_name: String(last_name).trim(),
      sex: sex || 'Other',
      birthdate: birthdate || '2000-01-01',
      barangay_id: Number(barangay_id),
      category: stdCategory,
      ip_classification: ip_classification || 'Non-IP',
      contact_number: normalizedContactNumber,
      sitio: sitio || '',
      address: computedAddress,
      household_id_number: is4Ps ? trimmedHh : null,
      beneficiary_id_code: is4Ps ? trimmedHh : null,
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user, beneficiary },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/register (admin-only) ───
router.post('/register', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { first_name, last_name, username, email, password, role, barangay_id, contact_number, address } = req.body;
    const trimmedUsername = username ? String(username).trim() : null;
    const trimmedEmail = email && String(email).trim() !== '' ? String(email).trim().toLowerCase() : null;

    if (trimmedUsername) {
      const existingUser = await User.findOne({ where: { username: trimmedUsername } });
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'Username is already taken' });
      }
    }

    if (trimmedEmail) {
      const existingEmail = await User.findOne({ where: { email: trimmedEmail } });
      if (existingEmail) {
        return res.status(409).json({ success: false, message: 'Email is already registered' });
      }
    }

    const user = await User.create({
      first_name,
      last_name,
      username: trimmedUsername,
      email: trimmedEmail,
      password,
      role: role || 'staff',
      barangay_id: barangay_id || null,
      contact_number,
      address,
    });
    res.status(201).json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/change-password (authenticated, any role) ───
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Current password at bagong password ay kinakailangan.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Ang bagong password ay dapat hindi bababa sa 6 characters.' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Verify current password using the same bcrypt setup as the rest of the app
    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password. Pakisubukan muli.' });
    }

    user.password = new_password;
    await user.save();

    return res.json({ success: true, message: 'Matagumpay na napalitan ang iyong password!' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
