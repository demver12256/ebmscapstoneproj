const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { User, Beneficiary, AuditLog, Message, SMSNotification, BeneficiaryDocument, Barangay } = require('../db');

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
      const seniorWhere = {
        category: { [Op.like]: '%Senior%' },
        [Op.and]: [
          { category: { [Op.notLike]: '%4Ps%' } },
          { category: { [Op.notLike]: '%Pantawid%' } },
        ],
      };
      if (req.user.role === 'senior_citizen_staff' && req.user.barangay_id) {
        seniorWhere.barangay_id = req.user.barangay_id;
      }
      const seniorBens = await Beneficiary.findAll({
        where: seniorWhere,
        attributes: ['user_id'],
        raw: true,
      });
      const seniorUserIds = seniorBens.map((b) => b.user_id).filter(Boolean);

      if (req.user.role === 'senior_citizen_staff' && req.user.barangay_id) {
        whereClause = {
          [Op.or]: [
            { id: req.user.id },
            { role: 'beneficiary', id: { [Op.in]: seniorUserIds } },
          ],
        };
      } else {
        whereClause = {
          [Op.or]: [
            { role: { [Op.in]: ['senior_citizen_staff', 'senior_citizen_admin'] } },
            { role: 'beneficiary', id: { [Op.in]: seniorUserIds } },
          ],
        };
      }
    } else if (['pwd_admin', 'pwd_staff'].includes(req.user.role)) {
      // PWD Admin & Staff strictly see PWD Beneficiaries & PWD Staff
      const pwdWhere = {
        [Op.or]: [
          { category: { [Op.like]: '%PWD%' } },
          { category: { [Op.like]: '%Disabilit%' } },
        ],
      };
      if (req.user.role === 'pwd_staff' && req.user.barangay_id) {
        pwdWhere.barangay_id = req.user.barangay_id;
      }
      const pwdBens = await Beneficiary.findAll({
        where: pwdWhere,
        attributes: ['user_id'],
        raw: true,
      });
      const pwdUserIds = pwdBens.map((b) => b.user_id).filter(Boolean);

      if (req.user.role === 'pwd_staff' && req.user.barangay_id) {
        whereClause = {
          [Op.or]: [
            { id: req.user.id },
            { role: 'beneficiary', id: { [Op.in]: pwdUserIds } },
          ],
        };
      } else {
        whereClause = {
          [Op.or]: [
            { role: { [Op.in]: ['pwd_staff', 'pwd_admin'] } },
            { role: 'beneficiary', id: { [Op.in]: pwdUserIds } },
          ],
        };
      }
    } else if (req.user.role === 'admin') {
      // DSWD Admin strictly sees 4Ps Beneficiaries & DSWD/Barangay Staff across the municipality
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
      // DSWD Staff: if barangay_id is assigned, strictly see 4Ps beneficiaries of that barangay
      const dswdWhere = {
        [Op.or]: [
          { category: { [Op.like]: '%4Ps%' } },
          { category: { [Op.like]: '%Pantawid%' } },
        ],
      };
      if (req.user.barangay_id) {
        dswdWhere.barangay_id = req.user.barangay_id;
      }
      const dswdBens = await Beneficiary.findAll({
        where: dswdWhere,
        attributes: ['user_id'],
        raw: true,
      });
      const dswdUserIds = dswdBens.map((b) => b.user_id).filter(Boolean);

      if (req.user.barangay_id) {
        whereClause = {
          [Op.or]: [
            { id: req.user.id },
            { role: 'beneficiary', id: { [Op.in]: dswdUserIds } },
          ],
        };
      } else {
        whereClause = {
          [Op.or]: [
            { role: { [Op.in]: ['staff', 'barangay', 'admin'] } },
            { role: 'beneficiary', id: { [Op.in]: dswdUserIds } },
          ],
        };
      }
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
          attributes: ['id', 'category', 'status', 'household_id_number', 'beneficiary_id_code', 'RFID_number', 'barangay_id', 'qr_token', 'approval_date', 'approved_at'],
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
        if (req.user.barangay_id && !barangay_id) {
          barangay_id = req.user.barangay_id;
        }
      } else {
        role = 'senior_citizen_staff';
      }
    } else if (['pwd_admin', 'pwd_staff'].includes(req.user.role)) {
      if (role === 'beneficiary' || req.user.role === 'pwd_staff') {
        role = 'beneficiary';
        category = 'Persons with Disabilities (PWD)';
        if (req.user.barangay_id && !barangay_id) {
          barangay_id = req.user.barangay_id;
        }
      } else {
        role = 'pwd_staff';
      }
    } else if (['admin', 'staff', 'barangay'].includes(req.user.role)) {
      if (role === 'beneficiary' || req.user.role === 'staff' || req.user.role === 'barangay') {
        role = 'beneficiary';
        if (!category) {
          category = '4Ps Household Beneficiaries';
        }
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
        if (req.user.barangay_id && !barangay_id) {
          barangay_id = req.user.barangay_id;
        }
      } else {
        if (!role || role === 'staff') role = 'mswdo_staff';
        if (role === 'mswdo_staff') barangay_id = null;
      }
    }

    // Kapag si Senior Admin o DSWD Admin ay lumikha ng staff, kinakailangan ang barangay assignment
    if (['senior_citizen_admin', 'admin'].includes(req.user.role) && role !== 'beneficiary') {
      if (!barangay_id) {
        return res.status(400).json({ success: false, message: 'Mangyaring pumili ng Barangay kung saan itatalaga ang staff.' });
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

    if (trimmedHouseholdId) {
      const existingHousehold = await Beneficiary.findOne({
        where: {
          [Op.or]: [
            { household_id_number: trimmedHouseholdId },
            { beneficiary_id_code: trimmedHouseholdId }
          ]
        }
      });
      if (existingHousehold) {
        return res.status(409).json({ success: false, message: 'Ang 4Ps Household Number / Beneficiary ID na ito ay nakatala na sa sistema.' });
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
      barangay_id: ['mswdo_staff'].includes(role) ? null : (barangay_id ? Number(barangay_id) : null),
      role
    });

    let createdBen = null;

    // Beneficiaries created by any Admin or Staff are directly approved and bypass Pending Review
    if (role === 'beneficiary') {
      const is4Ps = normalizedCategory.toLowerCase().includes('4ps');
      const currentYear = new Date().getFullYear();
      let customId;

      if (is4Ps) {
        if (trimmedHouseholdId) {
          customId = trimmedHouseholdId;
        } else {
          const count = await Beneficiary.count({
            where: {
              beneficiary_id_code: {
                [Op.like]: `4PS-${currentYear}-%`
              }
            }
          });
          let seq = count + 1;
          customId = `4PS-${currentYear}-${String(seq).padStart(4, '0')}`;
          while (await Beneficiary.findOne({ where: { [Op.or]: [{ beneficiary_id_code: customId }, { household_id_number: customId }] } })) {
            seq++;
            customId = `4PS-${currentYear}-${String(seq).padStart(4, '0')}`;
          }
        }
      } else {
        const count = await Beneficiary.count({
          where: {
            beneficiary_id_code: {
              [Op.like]: `BEN-${currentYear}-%`
            }
          }
        });
        let seq = count + 1;
        customId = `BEN-${currentYear}-${String(seq).padStart(4, '0')}`;
        while (await Beneficiary.findOne({ where: { beneficiary_id_code: customId } })) {
          seq++;
          customId = `BEN-${currentYear}-${String(seq).padStart(4, '0')}`;
        }
      }

      let resolvedBarangayId = barangay_id || req.user.barangay_id;
      if (!resolvedBarangayId) {
        const firstBrgy = await Barangay.findOne({ order: [['id', 'ASC']] });
        resolvedBarangayId = firstBrgy ? firstBrgy.id : 37;
      }

      const qrToken = Beneficiary.generateQrToken ? Beneficiary.generateQrToken() : require('crypto').randomBytes(16).toString('hex').toUpperCase();

      createdBen = await Beneficiary.create({
        user_id: user.id,
        first_name,
        last_name,
        sex: 'Other',
        birthdate: '2000-01-01',
        barangay_id: resolvedBarangayId,
        category: normalizedCategory,
        ip_classification: 'Non-IP',
        contact_number,
        address,
        status: 'Approved',
        household_id_number: is4Ps ? customId : null,
        beneficiary_id_code: customId,
        approval_date: new Date(),
        approved_at: new Date(),
        approving_staff_id: req.user.id,
        qr_token: qrToken,
        qr_generated_at: new Date(),
      });

      try {
        await AuditLog.create({
          user_id: req.user.id,
          action: `Created and directly approved beneficiary ${first_name} ${last_name}. Assigned ${is4Ps ? 'Household Number' : 'Beneficiary ID'}: ${customId}`,
          module: 'Beneficiary Management'
        });
      } catch (auditErr) {
        console.error('[AUDIT LOG ERROR]', auditErr);
      }

      if (contact_number) {
        try {
          await SMSNotification.create({
            beneficiary_id: createdBen.id,
            message: `Magandang araw ${first_name}! Ang iyong BeniAid account bilang benepisyaryo (${normalizedCategory}) ay direktang naaprubahan ni ${req.user.first_name || 'Admin'}. Ang iyong opisyal na ${is4Ps ? 'Household Number' : 'Beneficiary ID'} ay ${customId}.`,
            status: 'sent',
            sent_at: new Date()
          });
        } catch (smsErr) {
          console.warn('[SMS CREATION WARNING]', smsErr.message);
        }
      }
    }

    const userData = user.toJSON();
    delete userData.password;
    if (createdBen) {
      userData.Beneficiaries = [createdBen.toJSON()];
    }
    res.status(201).json({
      success: true,
      message: role === 'beneficiary'
        ? 'Matagumpay na nalikha at direktang naaprubahan ang benepisyaryo! Hindi na ito dadaan sa pending review at agad nang kasama sa opisyal na listahan.'
        : 'User account created successfully.',
      data: userData
    });
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

    if (['staff', 'barangay', 'senior_citizen_staff', 'pwd_staff'].includes(req.user.role) && req.user.barangay_id) {
      if (user.id !== req.user.id) {
        if (user.role !== 'beneficiary') {
          return res.status(403).json({ success: false, message: 'Forbidden: You do not have access to this user' });
        }
        const ben = await Beneficiary.findOne({ where: { user_id: user.id } });
        const targetBrgyId = ben?.barangay_id || user.barangay_id;
        if (Number(targetBrgyId) !== Number(req.user.barangay_id)) {
          return res.status(403).json({ success: false, message: 'Forbidden: You only have access to beneficiaries in your assigned barangay' });
        }
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

    if (['staff', 'barangay', 'senior_citizen_staff', 'pwd_staff'].includes(req.user.role) && req.user.barangay_id) {
      if (user.id !== req.user.id) {
        if (user.role !== 'beneficiary') {
          return res.status(403).json({ success: false, message: 'Forbidden: You do not have access to update this user' });
        }
        const ben = await Beneficiary.findOne({ where: { user_id: user.id } });
        const targetBrgyId = ben?.barangay_id || user.barangay_id;
        if (Number(targetBrgyId) !== Number(req.user.barangay_id)) {
          return res.status(403).json({ success: false, message: 'Forbidden: You can only update beneficiaries in your assigned barangay' });
        }
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

    if (updates.status) {
      if (updates.status === 'inactive') {
        const reason = updates.inactive_reason || 'Inactivated by Administrator';
        updates.inactive_reason = reason;
        await Beneficiary.update({ inactivation_reason: reason }, { where: { user_id: req.params.id } });
      } else if (updates.status === 'active') {
        updates.inactive_reason = null;
        await Beneficiary.update({ inactivation_reason: null }, { where: { user_id: req.params.id } });
      }
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

    if (['staff', 'barangay', 'senior_citizen_staff', 'pwd_staff'].includes(req.user.role) && req.user.barangay_id) {
      if (user.role !== 'beneficiary') {
        return res.status(403).json({ success: false, message: 'Forbidden: You do not have access to delete this user' });
      }
      const ben = await Beneficiary.findOne({ where: { user_id: user.id } });
      const targetBrgyId = ben?.barangay_id || user.barangay_id;
      if (Number(targetBrgyId) !== Number(req.user.barangay_id)) {
        return res.status(403).json({ success: false, message: 'Forbidden: You can only delete beneficiaries in your assigned barangay' });
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
