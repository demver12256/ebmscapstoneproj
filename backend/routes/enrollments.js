const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { Enrollment, Beneficiary, BenefitProgram } = require('../db');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const enrollments = await Enrollment.findAll({ include: [Beneficiary, BenefitProgram] });
    res.json({ success: true, data: enrollments });
  } catch (error) {
    next(error);
  }
});

router.post('/', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const enrollment = await Enrollment.create(req.body);
    res.status(201).json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    await Enrollment.update(req.body, { where: { id: req.params.id } });
    const enrollment = await Enrollment.findByPk(req.params.id);
    res.json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await Enrollment.destroy({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Enrollment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
