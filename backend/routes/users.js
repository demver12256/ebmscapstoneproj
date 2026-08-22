const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { User, Beneficiary, AuditLog, Message, SMSNotification, BeneficiaryDocument } = require('../db');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin', 'staff'));

router.get('/', async (req, res, next) => {
  try {
    let whereClause = {};
    if (req.user.role === 'staff') {
      whereClause = {
        role: 'beneficiary',
        barangay_id: req.user.barangay_id,
      };
    }
    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] }
    });
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    let { first_name, last_name, username, email, password, contact_number, address, barangay_id, role } = req.body;

    if (req.user.role === 'staff') {
      // Staff can only create beneficiaries for their own barangay
      role = 'beneficiary';
      barangay_id = req.user.barangay_id;
    }

    const trimmedUsername = username ? String(username).trim() : null;
    const trimmedEmail = email && String(email).trim() !== '' ? String(email).trim().toLowerCase() : null;

    if (!first_name || !last_name || (!trimmedUsername && !trimmedEmail) || !password || !role) {
      return res.status(400).json({ success: false, message: 'First name, last name, username or email, password, and role are required' });
    }

    if (trimmedUsername) {
      const existingUser = await User.findOne({ where: { username: trimmedUsername } });
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'A user with this username already exists' });
      }
    }

    if (trimmedEmail) {
      const existing = await User.findOne({ where: { email: trimmedEmail } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'A user with this email already exists' });
      }
    }

    const user = await User.create({
      first_name,
      last_name,
      username: trimmedUsername,
      email: trimmedEmail,
      password,
      contact_number,
      address,
      barangay_id,
      role
    });

    if (role === 'beneficiary') {
      await Beneficiary.create({
        user_id: user.id,
        first_name,
        last_name,
        sex: 'Other',
        birthdate: '2000-01-01',
        barangay_id: barangay_id,
        category: 'Non-IP',
        contact_number
      });
    }

    const userData = user.toJSON();
    delete userData.password;
    res.status(201).json({ success: true, data: userData });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.user.role === 'staff') {
      if (user.role !== 'beneficiary' || user.barangay_id !== req.user.barangay_id) {
        return res.status(403).json({ success: false, message: 'Forbidden: You do not have access to this user' });
      }
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.user.role === 'staff') {
      if (user.role !== 'beneficiary' || user.barangay_id !== req.user.barangay_id) {
        return res.status(403).json({ success: false, message: 'Forbidden: You do not have access to update this user' });
      }
    }

    const { password, ...updates } = req.body;
    if (password) {
      updates.password = password;
    }

    // Tiyakin na hindi mapapalitan ng staff ang role at barangay_id ng user
    if (req.user.role === 'staff') {
      delete updates.role;
      delete updates.barangay_id;
    }

    await User.update(updates, { where: { id: req.params.id } });
    const updatedUser = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    res.json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.user.role === 'staff') {
      if (user.role !== 'beneficiary' || user.barangay_id !== req.user.barangay_id) {
        return res.status(403).json({ success: false, message: 'Forbidden: You do not have access to delete this user' });
      }
    }

    // Delete in order to avoid FK constraint errors

    // 1. Delete messages where this user is sender or receiver
    await Message.destroy({ where: { sender_id: req.params.id } });
    await Message.destroy({ where: { receiver_id: req.params.id } });

    // 2. Delete audit logs for this user
    await AuditLog.destroy({ where: { user_id: req.params.id } });

    // 3. Delete SMS notifications and documents for beneficiaries of this user
    const beneficiaries = await Beneficiary.findAll({ where: { user_id: req.params.id } });
    for (const beneficiary of beneficiaries) {
      await SMSNotification.destroy({ where: { beneficiary_id: beneficiary.id } });
      await BeneficiaryDocument.destroy({ where: { beneficiary_id: beneficiary.id } });
    }

    // 4. Delete beneficiary records
    await Beneficiary.destroy({ where: { user_id: req.params.id } });

    // 5. Delete the user
    await User.destroy({ where: { id: req.params.id } });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
