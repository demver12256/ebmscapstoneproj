const express = require('express');
const { Sequelize } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { Barangay, Beneficiary } = require('../db');

const router = express.Router();

// Public endpoint for registration page (no auth required)
router.get('/public', async (req, res, next) => {
  try {
    const barangays = await Barangay.findAll({
      attributes: ['id', 'barangay_name'],
      order: [['barangay_name', 'ASC']],
    });
    res.json({ success: true, data: barangays });
  } catch (error) {
    next(error);
  }
});

router.use(authenticate);

router.get('/', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const barangays = await Barangay.findAll({
      order: [['barangay_name', 'ASC']],
    });

    // Get beneficiary counts per barangay (Only Approved Beneficiaries)
    const counts = await Beneficiary.findAll({
      where: {
        status: 'Approved',
      },
      attributes: [
        'barangay_id',
        'category',
        'ip_classification',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      ],
      group: ['barangay_id', 'category', 'ip_classification'],
      raw: true,
    });

    // Build a map: barangay_id -> { total, fourPs, senior, pwd, ip, nonIp }
    const statsMap = {};
    for (const row of counts) {
      const bid = row.barangay_id;
      if (!statsMap[bid]) {
        statsMap[bid] = { total: 0, fourPs: 0, senior: 0, pwd: 0, ip: 0, nonIp: 0 };
      }
      const c = parseInt(row.count, 10);
      statsMap[bid].total += c;

      // Category counts
      if (row.category === '4Ps Household Beneficiaries') {
        statsMap[bid].fourPs += c;
      } else if (row.category === 'Senior Citizens (Social Pension)') {
        statsMap[bid].senior += c;
      } else if (row.category === 'Persons with Disabilities (PWD)') {
        statsMap[bid].pwd += c;
      }

      // IP classification counts
      if (row.ip_classification === 'IP') {
        statsMap[bid].ip += c;
      } else {
        statsMap[bid].nonIp += c;
      }
    }

    // Merge stats into barangay data
    const data = barangays.map((b) => {
      const plain = b.toJSON();
      const stats = statsMap[plain.id] || { total: 0, fourPs: 0, senior: 0, pwd: 0, ip: 0, nonIp: 0 };
      return { ...plain, ...stats };
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    const barangay = await Barangay.create(req.body);
    res.status(201).json({ success: true, data: barangay });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await Barangay.update(req.body, { where: { id: req.params.id } });
    const barangay = await Barangay.findByPk(req.params.id);
    res.json({ success: true, data: barangay });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await Barangay.destroy({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Barangay deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
