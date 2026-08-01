const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { Beneficiary, Barangay, User, BeneficiaryDocument, AuditLog, SMSNotification, Message } = require('../db');

const router = express.Router();
router.use(authenticate);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/documents');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.'));
    }
  }
});

// Official Barangay Beneficiary List: Return only 'Approved' beneficiaries
router.get('/', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const where = {};
    if (req.user.role === 'staff' || req.user.role === 'barangay') {
      where.barangay_id = req.user.barangay_id;
      console.log(`[Beneficiaries] Fetching for ${req.user.role}: barangay_id=${req.user.barangay_id}`);
    } else {
      console.log('[Beneficiaries] Fetching for admin: all barangays');
    }
    where.status = 'Approved';
    const beneficiaries = await Beneficiary.findAll({ where, include: [Barangay, User] });
    console.log(`[Beneficiaries] Found ${beneficiaries.length} records`);
    res.json({ success: true, data: beneficiaries });
  } catch (error) {
    next(error);
  }
});

// Staff Dashboard Applications list: Return registrations (Pending Review, Under Review, Rejected, Approved)
// Restricts staff / barangay users to their registered barangay
router.get('/applications', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const where = {};
    if (req.user.role === 'staff' || req.user.role === 'barangay') {
      where.barangay_id = req.user.barangay_id;
    }
    
    // Once beneficiary submits, application should appear in Staff Dashboard under Pending Applications.
    // So status should not be 'Pending Submission'.
    where.status = {
      [Op.ne]: 'Pending Submission'
    };
    const applications = await Beneficiary.findAll({
      where,
      include: [Barangay, User, { model: BeneficiaryDocument, as: 'Documents' }],
      order: [['updated_at', 'DESC']]
    });
    res.json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
});

// Get currently logged-in beneficiary profile and documents
router.get('/me', authorize('beneficiary'), async (req, res, next) => {
  try {
    const { Enrollment, BenefitProgram, DistributionTransaction, DistributionEvent } = require('../db');
    
    const beneficiary = await Beneficiary.findOne({
      where: { user_id: req.user.id },
      include: [
        Barangay, 
        User, 
        { model: BeneficiaryDocument, as: 'Documents' },
        { 
          model: Enrollment, 
          as: 'Enrollments',
          include: [{ model: BenefitProgram }]
        },
        {
          model: DistributionTransaction,
          as: 'DistributionTransactions',
          include: [{ model: DistributionEvent, as: 'Event' }],
          order: [['created_at', 'DESC']],
          limit: 10
        }
      ]
    });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }
    res.json({ success: true, data: beneficiary });
  } catch (error) {
    next(error);
  }
});

// Update beneficiary profile (category, national id, psa cert number, etc.)
router.put('/me', authorize('beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }
    if (beneficiary.status !== 'Pending Submission' && beneficiary.status !== 'Rejected') {
      return res.status(400).json({ success: false, message: 'Cannot edit application after submission unless it is rejected.' });
    }

    const {
      category, sex, birthdate, civil_status, address, contact_number,
      national_id_number, psa_birth_cert_number, ip_classification
    } = req.body;

    // Check duplicates for national_id_number
    if (national_id_number) {
      const dup = await Beneficiary.findOne({
        where: {
          national_id_number,
          id: { [Op.ne]: beneficiary.id },
          status: { [Op.ne]: 'Rejected' }
        }
      });
      if (dup) {
        return res.status(409).json({ success: false, message: 'Duplicate registration: National ID number is already registered' });
      }
    }

    // Check duplicates for psa_birth_cert_number
    if (psa_birth_cert_number) {
      const dup = await Beneficiary.findOne({
        where: {
          psa_birth_cert_number,
          id: { [Op.ne]: beneficiary.id },
          status: { [Op.ne]: 'Rejected' }
        }
      });
      if (dup) {
        return res.status(409).json({ success: false, message: 'Duplicate registration: PSA Birth Certificate number is already registered' });
      }
    }

    await beneficiary.update({
      category,
      sex,
      birthdate,
      civil_status,
      address,
      contact_number,
      national_id_number,
      psa_birth_cert_number,
      ip_classification
    });

    res.json({ success: true, data: beneficiary });
  } catch (error) {
    next(error);
  }
});

// Upload document file
router.post('/me/documents', authorize('beneficiary'), upload.single('document'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }
    if (beneficiary.status !== 'Pending Submission' && beneficiary.status !== 'Rejected') {
      return res.status(400).json({ success: false, message: 'Cannot upload files after submission' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { document_type } = req.body;
    if (!document_type) {
      return res.status(400).json({ success: false, message: 'document_type is required' });
    }

    // Delete existing document of same type if it exists
    const existingDoc = await BeneficiaryDocument.findOne({
      where: { beneficiary_id: beneficiary.id, document_type }
    });
    if (existingDoc) {
      try {
        const fullPath = path.join(__dirname, '..', existingDoc.file_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (e) {
        console.error('Error deleting file:', e);
      }
      await existingDoc.destroy();
    }

    const relativePath = `uploads/documents/${req.file.filename}`;
    const doc = await BeneficiaryDocument.create({
      beneficiary_id: beneficiary.id,
      document_type,
      file_path: relativePath,
      file_name: req.file.originalname,
      file_size: req.file.size,
      mime_type: req.file.mimetype
    });

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
});

// Delete uploaded document file
router.delete('/me/documents/:docId', authorize('beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }
    if (beneficiary.status !== 'Pending Submission' && beneficiary.status !== 'Rejected') {
      return res.status(400).json({ success: false, message: 'Cannot delete files after submission' });
    }

    const doc = await BeneficiaryDocument.findOne({
      where: { id: req.params.docId, beneficiary_id: beneficiary.id }
    });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    try {
      const fullPath = path.join(__dirname, '..', doc.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (e) {
      console.error('Error unlinking file:', e);
    }

    await doc.destroy();
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Submit Application: updates status to Pending Review
router.post('/me/submit', authorize('beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({
      where: { user_id: req.user.id },
      include: [{ model: BeneficiaryDocument, as: 'Documents' }]
    });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }
    if (beneficiary.status !== 'Pending Submission' && beneficiary.status !== 'Rejected') {
      return res.status(400).json({ success: false, message: 'Application is already submitted' });
    }

    const { has_school_aged_children } = req.body;

    // Validate required fields - allow submission with basic info
    if (!beneficiary.category || beneficiary.category.trim() === '') {
      return res.status(400).json({ success: false, message: 'Please select a valid category first.' });
    }

    // National ID is optional for now - staff will verify
    // const docs = beneficiary.Documents || [];
    // const docTypes = docs.map(d => d.document_type);

    // Removed strict document validation - staff will review and request missing docs if needed

    // Double check duplicate checks during submission - optional
    // Allow submission even if there are duplicates; staff will handle during review

    // Set status to 'Pending Review'
    await beneficiary.update({
      status: 'Pending Review',
      rejection_reason: null,
      missing_documents: null
    });

    // Notify beneficiary
    await SMSNotification.create({
      beneficiary_id: beneficiary.id,
      message: `Your application has been successfully submitted and is pending review.`,
      status: 'sent',
      sent_at: new Date()
    });

    res.json({ success: true, message: 'Application submitted successfully', data: beneficiary });
  } catch (error) {
    next(error);
  }
});

// Get single application details
router.get('/:id', authorize('admin', 'staff', 'barangay', 'beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findByPk(req.params.id, {
      include: [Barangay, User, { model: BeneficiaryDocument, as: 'Documents' }]
    });

    // Barangay verification scoping check
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && beneficiary.barangay_id !== req.user.barangay_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only view applications from your own Barangay' });
    }

    res.json({ success: true, data: beneficiary });
  } catch (error) {
    next(error);
  }
});

// Update application status to Under Review
router.put('/applications/:id/review', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findByPk(req.params.id);
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Barangay verification scoping check
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && beneficiary.barangay_id !== req.user.barangay_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only review applications from your own Barangay' });
    }

    if (beneficiary.status === 'Pending Review') {
      await beneficiary.update({ status: 'Under Review' });

      // Log action to audit trail
      await AuditLog.create({
        user_id: req.user.id,
        action: `Updated status of application (Beneficiary: ${beneficiary.first_name} ${beneficiary.last_name}) to Under Review`,
        module: 'Beneficiary Review'
      });

      // Notify beneficiary
      await SMSNotification.create({
        beneficiary_id: beneficiary.id,
        message: `Your application status has been updated to Under Review.`,
        status: 'sent',
        sent_at: new Date()
      });
    }
    res.json({ success: true, data: beneficiary });
  } catch (error) {
    next(error);
  }
});

// Approve application
router.post('/applications/:id/approve', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findByPk(req.params.id);
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Barangay verification scoping check
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && beneficiary.barangay_id !== req.user.barangay_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only approve applications from your own Barangay' });
    }

    const currentYear = new Date().getFullYear();
    const count = await Beneficiary.count({
      where: {
        beneficiary_id_code: {
          [Op.like]: `BEN-${currentYear}-%`
        }
      }
    });
    const suffix = String(count + 1).padStart(4, '0');
    const customId = `BEN-${currentYear}-${suffix}`;

    await beneficiary.update({
      status: 'Approved',
      beneficiary_id_code: customId,
      approval_date: new Date(),
      approving_staff_id: req.user.id,
      rejection_reason: null,
      missing_documents: null
    });

    // Log action to audit trail
    await AuditLog.create({
      user_id: req.user.id,
      action: `Approved application for ${beneficiary.first_name} ${beneficiary.last_name}. Assigned ID: ${customId}`,
      module: 'Beneficiary Review'
    });

    // Notify beneficiary
    await SMSNotification.create({
      beneficiary_id: beneficiary.id,
      message: `Your application has been approved! Your Beneficiary ID is ${customId}.`,
      status: 'sent',
      sent_at: new Date()
    });

    res.json({ success: true, message: 'Application approved successfully', data: beneficiary });
  } catch (error) {
    next(error);
  }
});

// Reject application
router.post('/applications/:id/reject', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findByPk(req.params.id);
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Barangay verification scoping check
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && beneficiary.barangay_id !== req.user.barangay_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only reject applications from your own Barangay' });
    }

    const { rejection_reason, missing_documents } = req.body;
    if (!rejection_reason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const missingDocsString = missing_documents ? JSON.stringify(missing_documents) : null;

    await beneficiary.update({
      status: 'Rejected',
      rejection_reason,
      missing_documents: missingDocsString
    });

    // Log action to audit trail
    await AuditLog.create({
      user_id: req.user.id,
      action: `Rejected application for ${beneficiary.first_name} ${beneficiary.last_name}. Reason: ${rejection_reason}`,
      module: 'Beneficiary Review'
    });

    // Notify beneficiary
    const listMsg = missing_documents && missing_documents.length > 0 ? ` Invalid/missing documents: ${missing_documents.join(', ')}.` : '';
    await SMSNotification.create({
      beneficiary_id: beneficiary.id,
      message: `Your application was rejected. Reason: ${rejection_reason}.${listMsg} You can resubmit documents via the portal.`,
      status: 'sent',
      sent_at: new Date()
    });

    res.json({ success: true, message: 'Application rejected successfully', data: beneficiary });
  } catch (error) {
    next(error);
  }
});

// Updates and deletions
router.put('/:id', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    console.log(`[UPDATE BENEFICIARY] User: ${req.user.id} (${req.user.role}), Beneficiary ID: ${req.params.id}, Body:`, req.body);
    
    const beneficiary = await Beneficiary.findByPk(req.params.id, { include: [User] });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    // Barangay verification scoping check
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && beneficiary.barangay_id !== req.user.barangay_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only edit beneficiaries from your own Barangay' });
    }

    const { status, inactivation_reason, ...otherUpdates } = req.body;

    // If status is 'active' or 'inactive', update the beneficiary's User status
    // (This is safe now because each beneficiary has their own user account)
    if (status && (status === 'active' || status === 'inactive')) {
      console.log(`[UPDATE BENEFICIARY] Updating user (ID: ${beneficiary.User?.id}) status to: ${status}`);
      if (beneficiary.User && beneficiary.User.id) {
        await User.update({ status }, { where: { id: beneficiary.User.id } });
      }

      if (status === 'inactive') {
        otherUpdates.inactivation_reason = inactivation_reason || null;
      } else {
        otherUpdates.inactivation_reason = null;
      }
    } else if (inactivation_reason !== undefined) {
      otherUpdates.inactivation_reason = inactivation_reason;
    }

    // Update beneficiary with remaining fields (RFID_number, etc.)
    if (Object.keys(otherUpdates).length > 0) {
      console.log(`[UPDATE BENEFICIARY] Updating beneficiary fields:`, otherUpdates);
      await beneficiary.update(otherUpdates);
    }

    const updatedBeneficiary = await Beneficiary.findByPk(req.params.id, { include: [User] });
    console.log(`[UPDATE BENEFICIARY] Success!`);
    res.json({ success: true, data: updatedBeneficiary });
  } catch (error) {
    console.error(`[UPDATE BENEFICIARY] Error:`, error);
    next(error);
  }
});

router.delete('/:id', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findByPk(req.params.id);
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    // Barangay verification scoping check
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && beneficiary.barangay_id !== req.user.barangay_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only delete beneficiaries from your own Barangay' });
    }

    const userId = beneficiary.user_id;

    // Delete related data in order to avoid FK constraint errors
    if (userId) {
      // Delete messages where this user is sender or receiver
      await Message.destroy({ where: { sender_id: userId } });
      await Message.destroy({ where: { receiver_id: userId } });
      
      // Delete audit logs for this user
      await AuditLog.destroy({ where: { user_id: userId } });
    }

    // Delete SMS notifications for this beneficiary
    await SMSNotification.destroy({ where: { beneficiary_id: req.params.id } });

    // Delete beneficiary documents
    await BeneficiaryDocument.destroy({ where: { beneficiary_id: req.params.id } });

    // Delete beneficiary
    await Beneficiary.destroy({ where: { id: req.params.id } });

    // Delete associated user if exists
    if (userId) {
      await User.destroy({ where: { id: userId } });
    }

    res.json({ success: true, message: 'Beneficiary deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
