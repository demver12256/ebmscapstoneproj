const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
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
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
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
    const { first_name, last_name, email, password, barangay_id, contact_number, sex, birthdate, category, ip_classification, sitio, address, otp_token } = req.body;

    if (!first_name || !last_name || !email || !password || !barangay_id) {
      return res.status(400).json({ success: false, message: 'First name, last name, email, password, and barangay are required' });
    }

    // Verify OTP token
    if (!otp_token) {
      return res.status(400).json({ success: false, message: 'Email verification is required. Please verify your email with OTP first.' });
    }

    try {
      const decoded = jwt.verify(otp_token, process.env.JWT_SECRET);
      if (!decoded.otp_verified || decoded.email !== email) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP verification. Please verify your email again.' });
      }
    } catch (jwtErr) {
      return res.status(400).json({ success: false, message: 'OTP verification has expired. Please verify your email again.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email address is already registered' });
    }

    // Create User record
    const user = await User.create({
      first_name,
      last_name,
      email,
      password,
      role: 'beneficiary',
      barangay_id,
      contact_number,
      status: 'active'
    });

    let stdCategory = category || 'Persons with Disabilities (PWD)';
    if (category) {
      const lower = category.toLowerCase();
      if (lower.includes('4ps')) stdCategory = '4Ps Household Beneficiaries';
      else if (lower.includes('senior')) stdCategory = 'Senior Citizens (Social Pension)';
      else if (lower.includes('pwd') || lower.includes('disabil')) stdCategory = 'Persons with Disabilities (PWD)';
    }

    // Create corresponding Beneficiary record
    const beneficiary = await Beneficiary.create({
      user_id: user.id,
      first_name,
      last_name,
      sex: sex || 'Other',
      birthdate: birthdate || '2000-01-01',
      barangay_id,
      category: stdCategory,
      ip_classification: ip_classification || 'Non-IP',
      contact_number,
      sitio: sitio || '',
      address: address || ''
    });

    res.status(201).json({ success: true, data: { user, beneficiary } });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/register (admin-only) ───
router.post('/register', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { first_name, last_name, email, password, role, barangay_id, contact_number, address } = req.body;
    const user = await User.create({
      first_name,
      last_name,
      email,
      password,
      role,
      barangay_id,
      contact_number,
      address,
    });
    res.status(201).json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
