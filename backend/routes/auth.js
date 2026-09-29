const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { Op } = require('sequelize');
const { User, Beneficiary, Otp } = require('../db');

const router = express.Router();

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
          from: `"EBMS System" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'EBMS - Your Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
              <h2 style="color: #0038A8; margin-bottom: 8px;">EBMS Verification Code</h2>
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
    const { identifier } = req.body;
    const cleanId = (identifier || '').trim();

    if (!cleanId) {
      return res.status(400).json({ success: false, message: 'Email o Username ay kinakailangan.' });
    }

    // Check if user exists
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: cleanId },
          { username: cleanId },
        ],
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Walang nahanap na account para sa ibinigay na username/email.',
      });
    }

    const targetEmail = user.email;
    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        message: 'Walang nakatalagang email address ang account na ito. Mangyaring makipag-ugnayan sa Administrator.',
      });
    }

    // Invalidate prior OTPs
    await Otp.update({ verified: true }, { where: { email: targetEmail, verified: false } });

    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Otp.create({
      email: targetEmail,
      otp_code: otpCode,
      expires_at: expiresAt,
      verified: false,
    });

    // Mask email for privacy (e.g. j***@gmail.com)
    const [namePart, domainPart] = targetEmail.split('@');
    const maskedName = namePart.length > 2
      ? namePart[0] + '*'.repeat(namePart.length - 2) + namePart.slice(-1)
      : namePart[0] + '*';
    const maskedEmail = `${maskedName}@${domainPart}`;

    // Send via email if SMTP is configured
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"EBMS DSWD System" <${process.env.SMTP_USER}>`,
          to: targetEmail,
          subject: 'EBMS - Password Reset Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
              <h2 style="color: #0038A8; margin-bottom: 8px;">DSWD EBMS Password Reset</h2>
              <p style="color: #475569; margin-bottom: 24px;">Nakatanggap kami ng kahilingan na i-reset ang iyong password para sa user na <strong>${user.username || user.first_name}</strong>.</p>
              <p style="color: #475569; margin-bottom: 12px;">Gamitin ang sumusunod na 6-digit verification code. Mag-e-expire ito sa loob ng 10 minuto:</p>
              <div style="background: #0038A8; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 16px 32px; border-radius: 8px; letter-spacing: 8px; margin-bottom: 24px;">
                ${otpCode}
              </div>
              <p style="color: #94a3b8; font-size: 12px;">Kung hindi mo hiniling ang reset na ito, balewalain ang email na ito.</p>
            </div>
          `,
        });
        return res.json({
          success: true,
          message: `Naipadala ang verification code sa ${maskedEmail}`,
          email: targetEmail,
          masked_email: maskedEmail,
        });
      } catch (emailErr) {
        console.error('[FORGOT-PASSWORD] Email send failed:', emailErr.message);
      }
    }

    console.log(`[FORGOT-PASSWORD OTP] Code for ${targetEmail}: ${otpCode}`);
    return res.json({
      success: true,
      message: `Naipadala ang verification code sa ${maskedEmail}`,
      email: targetEmail,
      masked_email: maskedEmail,
      dev_otp: otpCode,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/forgot-password/reset ───
router.post('/forgot-password/reset', async (req, res, next) => {
  try {
    const { email, otp, new_password, otp_token } = req.body;

    if (!email || !new_password) {
      return res.status(400).json({ success: false, message: 'Email at bagong password ay kinakailangan.' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Ang password ay dapat hindi bababa sa 6 characters.' });
    }

    // Verify via otp_token or direct OTP code
    let isVerified = false;
    if (otp_token) {
      try {
        const decoded = jwt.verify(otp_token, process.env.JWT_SECRET);
        if (decoded.email === email && decoded.otp_verified) {
          isVerified = true;
        }
      } catch (err) {}
    }

    if (!isVerified && otp) {
      const otpRecord = await Otp.findOne({
        where: { email, otp_code: otp, verified: false },
        order: [['created_at', 'DESC']],
      });

      if (otpRecord && new Date() <= new Date(otpRecord.expires_at)) {
        otpRecord.verified = true;
        await otpRecord.save();
        isVerified = true;
      }
    }

    if (!isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Maling verification code o nag-expire na. Mangyaring humingi ng panibagong code.',
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.password = new_password;
    await user.save();

    return res.json({
      success: true,
      message: 'Matagumpay na napalitan ang iyong password! Maaari ka nang mag-sign in.',
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
        barangay_id: null,
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
          barangay_id: null,
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
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
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

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: loginIdentifier },
          { username: loginIdentifier },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Hindi nahanap ang account (User not found)' });
    }

    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    // Allow login even if inactive, but include status in response
    // Frontend will show appropriate notice based on status

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        inactive_reason: user.inactive_reason,
        barangay_id: user.barangay_id,
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

    if (!first_name || !last_name || !trimmedUsername || !password || !barangay_id) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, username, password, and barangay are required',
      });
    }

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
      // Verify OTP token only when email is provided
      if (!otp_token) {
        return res.status(400).json({
          success: false,
          message: 'Email verification is required when an email is provided. Please verify your email with OTP first.',
        });
      }

      try {
        const decoded = jwt.verify(otp_token, process.env.JWT_SECRET);
        if (!decoded.otp_verified || decoded.email.toLowerCase() !== trimmedEmail) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or expired OTP verification. Please verify your email again.',
          });
        }
      } catch (jwtErr) {
        return res.status(400).json({
          success: false,
          message: 'OTP verification has expired. Please verify your email again.',
        });
      }

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
      contact_number: contact_number ? String(contact_number).trim() : null,
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
      contact_number: contact_number ? String(contact_number).trim() : '',
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
