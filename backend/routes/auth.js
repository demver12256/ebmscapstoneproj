const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { User, Beneficiary } = require('../db');

const router = express.Router();

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

router.post('/register-beneficiary', async (req, res, next) => {
  try {
    const { first_name, last_name, email, password, barangay_id, contact_number, sex, birthdate, category, ip_classification, sitio, address } = req.body;

    if (!first_name || !last_name || !email || !password || !barangay_id) {
      return res.status(400).json({ success: false, message: 'First name, last name, email, password, and barangay are required' });
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

    // Create corresponding Beneficiary record
    const beneficiary = await Beneficiary.create({
      user_id: user.id,
      first_name,
      last_name,
      sex: sex || 'Other',
      birthdate: birthdate || '2000-01-01',
      barangay_id,
      category: category || 'Non-IP',
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
