const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { seedDatabase } = require('../seed');
const { Beneficiary, Barangay, BenefitProgram, Enrollment, Distribution, Attendance } = require('../db');

const router = express.Router();
router.use(authenticate);

router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    const result = await seedDatabase();
    res.json({ success: true, message: 'Database seeded successfully', data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-and-seed', authorize('admin'), async (req, res, next) => {
  try {
    console.log('🔄 Resetting database...');

    // Delete all data in order (respecting foreign key constraints)
    await Attendance.destroy({ where: {}, force: true });
    await Distribution.destroy({ where: {}, force: true });
    await Enrollment.destroy({ where: {}, force: true });
    await Beneficiary.destroy({ where: {}, force: true });
    await BenefitProgram.destroy({ where: {}, force: true });
    await Barangay.destroy({ where: {}, force: true });

    console.log('✅ Database cleared');

    // Now seed fresh data
    const result = await seedDatabase();
    res.json({ success: true, message: 'Database reset and seeded successfully', data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
