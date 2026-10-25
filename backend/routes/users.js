const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { User, Beneficiary, AuditLog, Message, SMSNotification, BeneficiaryDocument } = require('../db');

const normalizeBeneficiaryCategory = (category) => {
  const value = String(category || '').trim();
  if (!value) return 'Persons with Disabilities (PWD)';
  const lower = value.toLowerCase();
  if (lower.includes('4ps') || lower.includes('pantawid')) return '4Ps Household Beneficiaries';
  if (lower.includes('senior')) return 'Senior Citizens (Social Pension)';
  if (lower.includes('pwd') || lower.includes('disabil')) return 'Persons with Disabilities (PWD)';
  return value;
};

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin', 'staff'));

router.get('/', async (req, res, next) => {
  try {
    let whereClause = {};

    if (['senior_citizen_admin', 'senior_citizen_staff'].includes(req.user.role)) {
      // Senior Citizen Admin & Staff strictly see Senior Citizen Beneficiaries & Senior Staff
      const seniorBens = await Beneficiary.findAll({
        where: {
          category: { [Op.like]: '%Senior%' },
          [Op.and]: [
            { category: { [Op.notLike]: '%4Ps%' } },
            { category: { [Op.notLike]: '%Pantawid%' } },
          ],
        },
        attributes: ['user_id'],
        raw: true,
      });
      const seniorUserIds = seniorBens.map((b) => b.user_id).filter(Boolean);

      whereClause = {
        [Op.or]: [
          { role: { [Op.in]: ['senior_citizen_staff', 'senior_citizen_admin'] } },
          { role: 'beneficiary', id: { [Op.in]: seniorUserIds } },
        ],
      };
    } else if (['pwd_admin', 'pwd_staff'].includes(req.user.role)) {
      // PWD Admin & Staff strictly see PWD Beneficiaries & PWD Staff
      const pwdBens = await Beneficiary.findAll({
        where: {
          [Op.or]: [
            { category: { [Op.like]: '%PWD%' } },
            { category: { [Op.like]: '%Disabilit%' } },
          ],
        },
        attributes: ['user_id'],
        raw: true,
      });
      const pwdUserIds = pwdBens.map((b) => b.user_id).filter(Boolean);

      whereClause = {
        [Op.or]: [
          { role: { [Op.in]: ['pwd_staff', 'pwd_admin'] } },
          { role: 'beneficiary', id: { [Op.in]: pwdUserIds } },
        ],
      };
    } else if (req.user.role === 'admin') {
      // DSWD Admin strictly sees 4Ps Beneficiaries & DSWD/Barangay Staff
      const dswdBens = await Beneficiary.findAll({
        where: {
          [Op.or]: [
            { category: { [Op.like]: '%4Ps%' } },
            { category: { [Op.like]: '%Pantawid%' } },
          ],
        },
        attributes: ['user_id'],
        raw: true,
      });
      const dswdUserIds = dswdBens.map((b) => b.user_id).filter(Boolean);

      whereClause = {
        [Op.or]: [
          { role: { [Op.in]: ['staff', 'barangay', 'admin'] } },
          { role: 'beneficiary', id: { [Op.in]: dswdUserIds } },
        ],
      };
    } else if (['staff', 'barangay'].includes(req.user.role)) {
      // DSWD Staff sees 4Ps Beneficiaries & DSWD Staff across the municipality
      const dswdBens = await Beneficiary.findAll({
        where: {
          [Op.or]: [
            { category: { [Op.like]: '%4Ps%' } },
            { category: { [Op.like]: '%Pantawid%' } },
          ],
        },
        attributes: ['user_id'],
        raw: true,
      });
      const dswdUserIds = dswdBens.map((b) => b.user_id).filter(Boolean);

      whereClause = {
        [Op.or]: [
          { role: { [Op.in]: ['staff', 'barangay', 'admin'] } },
          { role: 'beneficiary', id: { [Op.in]: dswdUserIds } },
        ],
      };
    } else if (['mswdo_admin', 'mswdo_staff'].includes(req.user.role)) {
      // MSWDO Admin & Staff strictly see Municipal Beneficiaries (Senior Citizens and PWD)
      const mswdoBens = await Beneficiary.findAll({
        where: {
          [Op.or]: [
            { category: { [Op.like]: '%Senior%' } },
            { category: { [Op.like]: '%PWD%' } },
            { category: { [Op.like]: '%Disabilit%' } },
          ],
        },
        attributes: ['user_id'],
        raw: true,
      });
      const mswdoUserIds = mswdoBens.map((b) => b.user_id).filter(Boolean);

      whereClause = {
        [Op.or]: [
          { role: { [Op.in]: ['mswdo_staff', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin'] } },
          { role: 'beneficiary', id: { [Op.in]: mswdoUserIds } },
        ],
      };
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Beneficiary,
          attributes: ['id', 'category', 'status', 'household_id_number', 'RFID_number', 'barangay_id'],
          required: false,
        },
      ],
      order: [['role', 'ASC'], ['first_name', 'ASC']],
    });
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    let { first_name, last_name, username, email, password, contact_number, address, barangay_id, role, category, household_id_number } = req.body;

    if (['senior_citizen_admin', 'senior_citizen_staff'].includes(req.user.role)) {
      if (role === 'beneficiary' || req.user.role === 'senior_citizen_staff') {
        role = 'beneficiary';
        category = 'Senior Citizens (Social Pension)';
      } else {
        role = 'senior_citizen_staff';
        barangay_id = null;
      }
    } else if (['pwd_admin', 'pwd_staff'].includes(req.user.role)) {
      if (role === 'beneficiary' || req.user.role === 'pwd_staff') {
        role = 'beneficiary';
        category = 'Persons with Disabilities (PWD)';
      } else {
        role = 'pwd_staff';
        barangay_id = null;
      }
    } else if (['admin', 'staff', 'barangay'].includes(req.user.role)) {
      if (role === 'beneficiary' || req.user.role === 'staff' || req.user.role === 'barangay') {
        role = 'beneficiary';
        category = '4Ps Household Beneficiaries';
        if (req.user.barangay_id && !barangay_id) {
          barangay_id = req.user.barangay_id;
        }
      } else {
        if (!role || role === 'mswdo_staff') role = 'staff';
      }
    } else if (['mswdo_admin', 'mswdo_staff'].includes(req.user.role)) {
      if (role === 'beneficiary' || req.user.role === 'mswdo_staff') {
        role = 'beneficiary';
        if (!category || category.toLowerCase().includes('4ps')) {
          category = 'Senior Citizens (Social Pension)';
        }
      } else {
        if (!role || role === 'staff') role = 'mswdo_staff';
        if (role === 'mswdo_staff') barangay_id = null;
      }
    }

    const trimmedUsername = username ? String(username).trim() : null;
    const trimmedEmail = email && String(email).trim() !== '' ? String(email).trim().toLowerCase() : null;
    const normalizedCategory = normalizeBeneficiaryCategory(category);
    const trimmedHouseholdId = household_id_number ? String(household_id_number).trim() : null;

    if (!first_name || !last_name || (!trimmedUsername && !trimmedEmail) || !password || !role) {
      return res.status(400).json({ success: false, message: 'First name, last name, username or email, password, and role are required' });
    }

    if (role === 'beneficiary' && !category) {
      return res.status(400).json({ success: false, message: 'Please select the beneficiary category (4Ps, Senior, or PWD).' });
    }

    if (normalizedCategory.toLowerCase().includes('4ps') && !trimmedHouseholdId) {
      return res.status(400).json({ success: false, message: 'Household Number is required for 4Ps Household Beneficiaries.' });
    }

    if (normalizedCategory.toLowerCase().includes('4ps') && trimmedHouseholdId) {
      const existingHousehold = await Beneficiary.findOne({
        where: {
          [Op.or]: [
            { household_id_number: trimmedHouseholdId },
            { beneficiary_id_code: trimmedHouseholdId }
          ]
        }
      });
      if (existingHousehold) {
        return res.status(409).json({ success: false, message: 'This 4Ps Household Number is already registered in the system.' });
      }
    }

    if (trimmedUsername) {
      const existingUser = await User.findOne({ where: { username: trimmedUsername } });
      if (existingUser) {
        return res.status(409).json({ success: false, message: `Ang username na "${trimmedUsername}" ay nagamit na. Pumili ng ibang username.` });
      }
    }

    if (trimmedEmail) {
      const existing = await User.findOne({ where: { email: trimmedEmail } });
      if (existing) {
        return res.status(409).json({ success: false, message: `Ang email na "${trimmedEmail}" ay nakarehistro na sa ibang user.` });
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
      barangay_id: ['mswdo_staff', 'senior_citizen_staff', 'pwd_staff'].includes(role) ? null : barangay_id,
      role
    });

    if (role === 'beneficiary') {
      const is4Ps = normalizedCategory.toLowerCase().includes('4ps');
      await Beneficiary.create({
        user_id: user.id,
        first_name,
        last_name,
        sex: 'Other',
        birthdate: '2000-01-01',
        barangay_id: barangay_id,
        category: normalizedCategory,
        ip_classification: 'Non-IP',
        contact_number,
        address,
        status: 'Pending Review',
        household_id_number: is4Ps ? trimmedHouseholdId : null,
        beneficiary_id_code: is4Ps ? trimmedHouseholdId : null,
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
    if (req.user.role === 'staff' || req.user.role === 'mswdo_staff') {
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
