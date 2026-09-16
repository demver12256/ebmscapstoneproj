const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { Beneficiary, Barangay, User, BeneficiaryDocument, AuditLog, SMSNotification, Notification, Message, AnnouncementRecipient, Announcement, Attendance, DistributionTransaction, DistributionEvent, BenefitProgram, Enrollment } = require('../db');
const { isMswdoRole, MSWDO_CATEGORY_FILTER, isMswdoCategory } = require('../utils/roles');

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
    const allowedMimes = [
      'application/pdf', 
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'image/jpeg', 
      'image/jpg', 
      'image/png'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word (DOC/DOCX), JPG, JPEG, and PNG are allowed.'));
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
      console.log(`[Beneficiaries] Fetching for ${req.user.role}: all barangays`);
    }
    where.status = 'Approved';
    // Both MSWDO and DSWD view the full municipal registry of approved beneficiaries (4Ps, Senior Citizens, PWD)
    const beneficiaries = await Beneficiary.findAll({ where, include: [Barangay, User] });
    console.log(`[Beneficiaries] Found ${beneficiaries.length} records`);
    res.json({ success: true, data: beneficiaries });
  } catch (error) {
    next(error);
  }
});

// Admin Applications list: Return registrations (Pending Review, Under Review, Rejected, Approved)
// Only Administrator can view applicant submissions queue (MSWDO sees Senior/PWD only)
router.get('/applications', authorize('admin'), async (req, res, next) => {
  try {
    const where = {
      status: {
        [Op.ne]: 'Pending Submission'
      }
    };
    // MSWDO admin only approves Senior Citizens & PWD applications (4Ps is approved by DSWD)
    // DSWD admin approves 4Ps, Senior Citizens, and PWD
    if (isMswdoRole(req.user.role)) {
      where[Op.and] = [
        {
          [Op.or]: [
            { category: { [Op.like]: '%Senior%' } },
            { category: { [Op.like]: '%PWD%' } },
            { category: { [Op.like]: '%Disabilit%' } },
          ]
        },
        { category: { [Op.notLike]: '%4Ps%' } },
        { category: { [Op.notLike]: '%Pantawid%' } }
      ];
      console.log('[Applications] MSWDO filter: Senior + PWD only (excluding 4Ps)');
    } else {
      console.log('[Applications] DSWD filter: All categories (4Ps, Senior, PWD)');
    }
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
    console.log('[GET /me] Request from user:', req.user.id);
    const { checkAndProcessExpiredDistributions } = require('../utils/distributionScheduler');
    await checkAndProcessExpiredDistributions();
    
    const { Enrollment, BenefitProgram, DistributionTransaction, DistributionEvent } = require('../db');
    
    if (!req.user || !req.user.id) {
      console.error('[GET /me] No user ID in request');
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    let beneficiary = await Beneficiary.findOne({
      where: { user_id: req.user.id },
      include: [
        { model: Barangay, required: false },
        { model: User, required: false },
        { model: BeneficiaryDocument, as: 'Documents', required: false },
        { 
          model: Enrollment, 
          as: 'Enrollments',
          required: false,
          where: { status: 'active' },
          include: [{ model: BenefitProgram, required: false }]
        },
        {
          model: DistributionTransaction,
          as: 'DistributionTransactions',
          required: false,
          include: [{
            model: DistributionEvent,
            as: 'Event',
            required: false,
            include: [{ model: BenefitProgram, as: 'Program', attributes: ['id', 'name', 'code', 'benefit_type', 'agency'], required: false }]
          }],
          order: [['created_at', 'DESC']],
          limit: 10
        }
      ]
    });
    
    if (!beneficiary) {
      console.warn('[GET /me] Beneficiary not found for user ID:', req.user.id, '- Auto-creating beneficiary record');
      const user = await User.findByPk(req.user.id);
      if (user) {
        await Beneficiary.create({
          user_id: user.id,
          first_name: user.first_name || 'Beneficiary',
          last_name: user.last_name || 'User',
          sex: 'Other',
          birthdate: '2000-01-01',
          barangay_id: null,
          category: 'Persons with Disabilities (PWD)',
          ip_classification: 'Non-IP',
          contact_number: user.phone || '',
          sitio: '',
          address: '',
        });

        beneficiary = await Beneficiary.findOne({
          where: { user_id: req.user.id },
          include: [
            { model: Barangay, required: false },
            { model: User, required: false },
            { model: BeneficiaryDocument, as: 'Documents', required: false },
            { 
              model: Enrollment, 
              as: 'Enrollments',
              required: false,
              where: { status: 'active' },
              include: [{ model: BenefitProgram, required: false }]
            },
            {
              model: DistributionTransaction,
              as: 'DistributionTransactions',
              required: false,
              include: [{
                model: DistributionEvent,
                as: 'Event',
                required: false,
                include: [{ model: BenefitProgram, as: 'Program', attributes: ['id', 'name', 'code', 'benefit_type', 'agency'], required: false }]
              }],
              order: [['created_at', 'DESC']],
              limit: 10
            }
          ]
        });
      }
    }

    if (!beneficiary) {
      console.error('[GET /me] Beneficiary still not found for user:', req.user.id);
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }

    // Auto-sync category from active enrollment if available
    if (beneficiary.Enrollments && beneficiary.Enrollments.length > 0) {
      const activeEn = beneficiary.Enrollments.find(e => e.status === 'active');
      if (activeEn && activeEn.BenefitProgram) {
        const prog = activeEn.BenefitProgram;
        const progCat = prog.eligibility_category || prog.category;
        if (progCat) {
          let stdCat = progCat;
          const lower = progCat.toLowerCase();
          if (lower.includes('4ps')) stdCat = '4Ps Household Beneficiaries';
          else if (lower.includes('senior')) stdCat = 'Senior Citizens (Social Pension)';
          else if (lower.includes('pwd') || lower.includes('disabil')) stdCat = 'Persons with Disabilities (PWD)';

          if (beneficiary.category !== stdCat) {
            await beneficiary.update({ category: stdCat });
            beneficiary.category = stdCat;
          }
        }
      }
    }
    
    console.log('[GET /me] Successfully fetched beneficiary:', beneficiary.id);
    res.json({ success: true, data: beneficiary });
  } catch (error) {
    console.error('[GET /me] Error:', error);
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

// Beneficiary self-service payout account registration/update
router.put('/me/payout-account', authorize('beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id }, include: [User, Barangay] });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }

    const { payout_preference, payout_provider, payout_account_number, payout_account_name } = req.body;

    if (payout_preference === 'cash_otc') {
      await beneficiary.update({
        payout_preference: 'cash_otc',
        payout_provider: null,
        payout_account_number: null,
        payout_account_name: null,
        account_verification_status: 'unverified',
        account_verified_at: null,
      });

      await AuditLog.create({
        user_id: req.user.id,
        action: `Beneficiary (${beneficiary.first_name} ${beneficiary.last_name}) set payout method to Cash OTC / Physical RFID`,
        module: 'Payout Settings'
      });

      return res.json({
        success: true,
        message: 'Payout method updated to Cash OTC / Physical RFID.',
        data: beneficiary
      });
    }

    // Digital payout validation
    if (!payout_provider || !payout_account_number) {
      return res.status(400).json({
        success: false,
        message: 'Mangyaring ilagay ang E-Wallet/Bank Provider at Account Number.'
      });
    }

    const cleanedNumber = String(payout_account_number).replace(/[\s-]/g, '').trim();
    const accountName = (payout_account_name && payout_account_name.trim()) 
      ? payout_account_name.trim() 
      : `${beneficiary.first_name} ${beneficiary.last_name}`;

    await beneficiary.update({
      payout_preference: 'digital',
      payout_provider: payout_provider.trim(),
      payout_account_number: cleanedNumber,
      payout_account_name: accountName,
      account_verification_status: 'unverified',
      account_verified_at: null,
    });

    await AuditLog.create({
      user_id: req.user.id,
      action: `Beneficiary (${beneficiary.first_name} ${beneficiary.last_name}) submitted digital payout account: ${payout_provider} (${cleanedNumber}) - Pending Admin Verification`,
      module: 'Payout Settings'
    });

    console.log(`[PAYOUT] Beneficiary ${beneficiary.id} submitted payout account (${payout_provider}: ${cleanedNumber}). Status: unverified`);

    // ── NOTIFY ADMIN FOR VERIFICATION & POPUP ──
    try {
      const targetRoles = ['admin'];
      if (isMswdoCategory(beneficiary.category)) {
        targetRoles.push('mswdo_admin');
      }

      const adminUsers = await User.findAll({
        where: {
          role: { [Op.in]: targetRoles },
          status: 'active'
        },
        attributes: ['id', 'role', 'first_name', 'last_name']
      });

      const barangayName = beneficiary.Barangay?.barangay_name ? ` (Brgy. ${beneficiary.Barangay.barangay_name})` : '';
      const maskedNumber = cleanedNumber.length > 7
        ? cleanedNumber.replace(/(.{4})(.*)(.{3})/, '$1****$3')
        : cleanedNumber;

      const notifTitle = `Bagong Digital Payout Account: ${beneficiary.first_name} ${beneficiary.last_name}`;
      const notifMessage = `Si ${beneficiary.first_name} ${beneficiary.last_name}${barangayName} mula sa kategoryang ${beneficiary.category || 'General'} ay nag-rehistro ng bagong digital payout account:\n\n• Provider: ${payout_provider.trim()}\n• Account Number: ${maskedNumber}\n• Account Name: ${accountName}\n\nNakahain ito para sa inyong beripikasyon sa Beneficiary Records bago mag-disburse ng digital ayuda.`;

      const notifPromises = adminUsers.map(admin => {
        return Notification.create({
          user_id: admin.id,
          title: notifTitle,
          message: notifMessage,
          type: 'system',
          reference_id: beneficiary.id,
          reference_type: 'payout_verification',
          is_read: false
        });
      });

      await Promise.all(notifPromises);
      console.log(`[PAYOUT NOTIF] Created notifications for ${adminUsers.length} admin(s) (${targetRoles.join(', ')})`);
    } catch (notifErr) {
      console.error('[PAYOUT NOTIF ERROR] Failed to create admin notifications:', notifErr);
    }

    res.json({
      success: true,
      message: 'Matagumpay na naisumite ang iyong payout account! Maghihintay ito ng beripikasyon mula sa Admin.',
      data: beneficiary
    });
  } catch (error) {
    console.error('[PAYOUT ERROR]', error);
    next(error);
  }
});

// ── POST /me/extra-payout-accounts ── Add a secondary payout account
router.post('/me/extra-payout-accounts', authorize('beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id }, include: [User, Barangay] });
    if (!beneficiary) return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });

    const { provider, account_number, account_name } = req.body;
    if (!provider || !account_number) {
      return res.status(400).json({ success: false, message: 'Provider at Account Number ay kinakailangan.' });
    }

    const extras = Array.isArray(beneficiary.extra_payout_accounts) ? beneficiary.extra_payout_accounts : [];
    if (extras.length >= 3) {
      return res.status(400).json({ success: false, message: 'Maximum na 3 lamang ang maaaring extra payout accounts.' });
    }

    const cleanedNumber = String(account_number).replace(/[\s-]/g, '').trim();
    const accountName = (account_name && account_name.trim()) ? account_name.trim() : `${beneficiary.first_name} ${beneficiary.last_name}`;

    // Check for duplicate
    const isDuplicate = extras.some(e => e.provider === provider.trim() && e.account_number === cleanedNumber);
    if (isDuplicate) {
      return res.status(400).json({ success: false, message: 'Mayroon nang ganyang account na naka-rehistro.' });
    }

    const newAccount = {
      provider: provider.trim(),
      account_number: cleanedNumber,
      account_name: accountName,
      verification_status: 'unverified',
      added_at: new Date().toISOString(),
    };

    extras.push(newAccount);
    await beneficiary.update({ extra_payout_accounts: extras });

    // Notify admin
    try {
      const targetRoles = ['admin'];
      if (isMswdoCategory(beneficiary.category)) targetRoles.push('mswdo_admin');
      const adminUsers = await User.findAll({ where: { role: { [Op.in]: targetRoles }, status: 'active' }, attributes: ['id'] });
      const barangayName = beneficiary.Barangay?.barangay_name ? ` (Brgy. ${beneficiary.Barangay.barangay_name})` : '';
      const maskedNum = cleanedNumber.length > 7 ? cleanedNumber.replace(/(.{4})(.*)(.{3})/, '$1****$3') : cleanedNumber;
      await Promise.all(adminUsers.map(admin => Notification.create({
        user_id: admin.id,
        title: `Bagong Secondary Payout Account: ${beneficiary.first_name} ${beneficiary.last_name}`,
        message: `Si ${beneficiary.first_name} ${beneficiary.last_name}${barangayName} ay nagdagdag ng pangalawang payout account:\n\n• Provider: ${provider.trim()}\n• Account Number: ${maskedNum}\n• Account Name: ${accountName}\n\nNakahain ito para sa inyong beripikasyon.`,
        type: 'system', reference_id: beneficiary.id, reference_type: 'payout_verification', is_read: false,
      })));
    } catch (notifErr) {
      console.error('[EXTRA PAYOUT NOTIF ERROR]', notifErr);
    }

    await AuditLog.create({
      user_id: req.user.id,
      action: `Beneficiary (${beneficiary.first_name} ${beneficiary.last_name}) added extra payout account: ${provider} (${cleanedNumber})`,
      module: 'Payout Settings'
    });

    res.json({ success: true, message: 'Naidagdag ang bagong payout account! Maghihintay ng beripikasyon ng Admin.', data: beneficiary });
  } catch (error) {
    console.error('[EXTRA PAYOUT ADD ERROR]', error);
    next(error);
  }
});

// ── DELETE /me/extra-payout-accounts/:index ── Remove a secondary payout account
router.delete('/me/extra-payout-accounts/:index', authorize('beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });

    const idx = parseInt(req.params.index, 10);
    const extras = Array.isArray(beneficiary.extra_payout_accounts) ? [...beneficiary.extra_payout_accounts] : [];

    if (isNaN(idx) || idx < 0 || idx >= extras.length) {
      return res.status(400).json({ success: false, message: 'Invalid account index.' });
    }

    const removed = extras.splice(idx, 1)[0];
    await beneficiary.update({ extra_payout_accounts: extras.length > 0 ? extras : null });

    await AuditLog.create({
      user_id: req.user.id,
      action: `Beneficiary (${beneficiary.first_name} ${beneficiary.last_name}) removed extra payout account: ${removed?.provider} (${removed?.account_number})`,
      module: 'Payout Settings'
    });

    res.json({ success: true, message: 'Natanggal ang payout account.', data: beneficiary });
  } catch (error) {
    console.error('[EXTRA PAYOUT DELETE ERROR]', error);
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

// Upload profile picture
router.post('/me/profile-picture', authorize('beneficiary'), upload.single('profile_picture'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Delete old profile picture if exists
    if (beneficiary.profile_picture) {
      try {
        const fullPath = path.join(__dirname, '..', beneficiary.profile_picture);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (e) {
        console.error('Error deleting old profile picture:', e);
      }
    }

    const relativePath = `uploads/documents/${req.file.filename}`;
    await beneficiary.update({ profile_picture: relativePath });

    res.json({ success: true, message: 'Profile picture updated', data: { profile_picture: relativePath } });
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

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    // Barangay verification scoping check
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && beneficiary.barangay_id !== req.user.barangay_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only view applications from your own Barangay' });
    }

    // MSWDO scope: Senior & PWD only (4Ps is managed by DSWD)
    if (isMswdoRole(req.user.role) && !isMswdoCategory(beneficiary.category)) {
      return res.status(403).json({ success: false, message: 'MSWDO access restricted to Senior Citizens and PWD beneficiaries. 4Ps beneficiaries are managed by DSWD.' });
    }

    res.json({ success: true, data: beneficiary });
  } catch (error) {
    next(error);
  }
});

// ── GET /:id/attendance ── Beneficiary Meeting Attendance History & Summary Stats (Admin / Staff)
router.get('/:id/attendance', authorize('admin', 'staff', 'barangay', 'mswdo_admin'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findByPk(req.params.id, {
      include: [
        { model: Barangay, attributes: ['id', 'barangay_name'] },
        { model: User, attributes: ['id', 'first_name', 'last_name', 'email', 'contact_number'] },
      ],
    });

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    // Barangay verification scoping check
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && req.user.barangay_id && beneficiary.barangay_id !== req.user.barangay_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only view attendance for beneficiaries in your own Barangay' });
    }

    // Two-way agency isolation: identify all MSWDO admin users
    const mswdoUsers = await User.findAll({ where: { role: 'mswdo_admin' }, attributes: ['id'] });
    const mswdoUserIds = mswdoUsers.map(u => u.id);
    const isMswdo = isMswdoRole(req.user.role);

    // Auto-link any published or completed announcements targeting this beneficiary
    // MSWDO sees announcements created by MSWDO OR where notify_mswdo is true
    // DSWD sees announcements created by DSWD
    const announcementWhere = { status: { [Op.in]: ['published', 'completed'] } };
    if (isMswdo) {
      announcementWhere[Op.or] = [
        { created_by_user_id: { [Op.in]: mswdoUserIds.length ? mswdoUserIds : [-1] } },
        { notify_mswdo: true },
      ];
    } else if (req.user.role !== 'beneficiary') {
      announcementWhere.created_by_user_id = { [Op.notIn]: mswdoUserIds.length ? mswdoUserIds : [-1] };
    }
    const publishedAnnouncements = await Announcement.findAll({
      where: announcementWhere,
    });

    const benCategory = (beneficiary.category || '').toLowerCase();

    for (const ann of publishedAnnouncements) {
      let targetBarangays = [];
      if (typeof ann.target_barangays === 'string') {
        try { targetBarangays = JSON.parse(ann.target_barangays); } catch (e) { targetBarangays = [ann.target_barangays]; }
      } else if (Array.isArray(ann.target_barangays)) {
        targetBarangays = ann.target_barangays;
      }
      targetBarangays = targetBarangays.map(Number).filter(Boolean);

      let targetPrograms = [];
      if (typeof ann.target_programs === 'string') {
        try { targetPrograms = JSON.parse(ann.target_programs); } catch (e) { targetPrograms = [ann.target_programs]; }
      } else if (Array.isArray(ann.target_programs)) {
        targetPrograms = ann.target_programs;
      }

      let matchesCategory = false;
      if (targetPrograms.length === 0) {
        matchesCategory = true;
      } else {
        matchesCategory = targetPrograms.some(cat => {
          const normCat = String(cat).toLowerCase();
          if (normCat.includes('4ps')) return benCategory.includes('4ps');
          if (normCat.includes('senior')) return benCategory.includes('senior');
          if (normCat.includes('pwd') || normCat.includes('disabil')) return benCategory.includes('pwd') || benCategory.includes('disabil');
          return benCategory.includes(normCat);
        });
      }

      const matchesBarangay =
        targetBarangays.length === 0 ||
        (beneficiary.barangay_id && targetBarangays.includes(Number(beneficiary.barangay_id)));

      if (matchesBarangay && matchesCategory) {
        await AnnouncementRecipient.findOrCreate({
          where: {
            announcement_id: ann.id,
            beneficiary_id: beneficiary.id,
          },
          defaults: {
            announcement_id: ann.id,
            beneficiary_id: beneficiary.id,
            user_id: beneficiary.user_id,
            is_read: false,
            attendance_status: 'Pending',
            notification_sent: true,
          },
        });
      }
    }

    // Fetch all recipient links with announcement details and staff scanner info
    const recipientLinks = await AnnouncementRecipient.findAll({
      where: { beneficiary_id: beneficiary.id },
      include: [
        {
          model: Announcement,
          include: [
            {
              model: User,
              as: 'CreatedBy',
              attributes: ['id', 'first_name', 'last_name', 'email'],
            },
          ],
        },
        {
          model: User,
          as: 'ScannedByStaff',
          attributes: ['id', 'first_name', 'last_name'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const records = [];
    for (const r of recipientLinks) {
      if (!r.Announcement || !['published', 'completed'].includes(r.Announcement.status)) continue;

      // Attendance scoping:
      // If MSWDO: can see attendance for announcements created by MSWDO OR announcements where DSWD selected notify_mswdo: true
      if (isMswdo) {
        const isMswdoCreated = r.Announcement.created_by_user_id && mswdoUserIds.includes(r.Announcement.created_by_user_id);
        const isNotified = Boolean(r.Announcement.notify_mswdo);
        if (!isMswdoCreated && !isNotified) {
          continue;
        }
      }
      // DSWD Admin & Staff can ONLY see attendance for announcements created by DSWD (NOT MSWDO)
      if (!isMswdo && req.user.role !== 'beneficiary' && mswdoUserIds.includes(r.Announcement.created_by_user_id)) {
        continue;
      }

      let targetBarangays = [];
      if (typeof r.Announcement.target_barangays === 'string') {
        try { targetBarangays = JSON.parse(r.Announcement.target_barangays); } catch (e) { targetBarangays = [r.Announcement.target_barangays]; }
      } else if (Array.isArray(r.Announcement.target_barangays)) {
        targetBarangays = r.Announcement.target_barangays;
      }
      targetBarangays = targetBarangays.map(Number).filter(Boolean);

      let targetPrograms = [];
      if (typeof r.Announcement.target_programs === 'string') {
        try { targetPrograms = JSON.parse(r.Announcement.target_programs); } catch (e) { targetPrograms = [r.Announcement.target_programs]; }
      } else if (Array.isArray(r.Announcement.target_programs)) {
        targetPrograms = r.Announcement.target_programs;
      }

      const matchesBarangay =
        targetBarangays.length === 0 ||
        (beneficiary.barangay_id && targetBarangays.includes(Number(beneficiary.barangay_id)));

      let matchesCategory = false;
      if (targetPrograms.length === 0) {
        matchesCategory = true;
      } else {
        matchesCategory = targetPrograms.some(cat => {
          const normCat = String(cat).toLowerCase();
          if (normCat.includes('4ps')) return benCategory.includes('4ps');
          if (normCat.includes('senior')) return benCategory.includes('senior');
          if (normCat.includes('pwd') || normCat.includes('disabil')) return benCategory.includes('pwd') || benCategory.includes('disabil');
          return benCategory.includes(normCat);
        });
      }

      if (matchesBarangay && matchesCategory) {
        const item = r.Announcement.toJSON();
        item.attendance_status = r.attendance_status; // 'Pending' | 'Present' | 'Absent'
        item.scanned_at = r.scanned_at;
        item.is_read = r.is_read;
        item.read_at = r.read_at;
        item.recipient_id = r.id;
        item.ScannedByStaff = r.ScannedByStaff ? {
          id: r.ScannedByStaff.id,
          first_name: r.ScannedByStaff.first_name,
          last_name: r.ScannedByStaff.last_name,
        } : null;
        records.push(item);
      }
    }

    // Compute stats
    const totalMeetings = records.length;
    const presentCount = records.filter(rec => rec.attendance_status === 'Present').length;
    const absentCount = records.filter(rec => rec.attendance_status === 'Absent').length;
    const pendingCount = records.filter(rec => rec.attendance_status === 'Pending').length;
    const concludedCount = presentCount + absentCount;
    const complianceRate = concludedCount > 0 ? Math.round((presentCount / concludedCount) * 100) : 100;

    res.json({
      success: true,
      data: {
        beneficiary: {
          id: beneficiary.id,
          first_name: beneficiary.first_name,
          last_name: beneficiary.last_name,
          RFID_number: beneficiary.RFID_number,
          beneficiary_id_code: beneficiary.beneficiary_id_code,
          category: beneficiary.category,
          status: beneficiary.status,
          barangay: beneficiary.Barangay?.barangay_name || 'N/A',
        },
        stats: {
          total_meetings: totalMeetings,
          present_count: presentCount,
          absent_count: absentCount,
          pending_count: pendingCount,
          compliance_rate: complianceRate,
        },
        records,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /:id/distributions ── Beneficiary Claimed Distributions History & Stats
router.get('/:id/distributions', authorize('admin', 'staff', 'barangay', 'mswdo_admin', 'beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findByPk(req.params.id, {
      include: [
        { model: Barangay, attributes: ['id', 'barangay_name'] },
        { model: User, attributes: ['id', 'first_name', 'last_name', 'email'] },
      ],
    });

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    // Scoping check for beneficiary role
    if (req.user.role === 'beneficiary') {
      const ownBen = await Beneficiary.findOne({ where: { user_id: req.user.id } });
      if (!ownBen || ownBen.id !== beneficiary.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized: You can only view your own distribution records.' });
      }
    }

    // Barangay verification scoping check
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && req.user.barangay_id && beneficiary.barangay_id !== req.user.barangay_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only view distributions for beneficiaries in your own Barangay' });
    }

    // Agency-level scoping:
    // MSWDO Admin can ONLY access distributions created under MSWDO
    // DSWD Admin & Staff can ONLY access distributions created under DSWD
    const eventWhere = {};
    if (isMswdoRole(req.user.role)) {
      eventWhere.agency = 'MSWDO';
    } else if (['admin', 'staff', 'barangay'].includes(req.user.role)) {
      eventWhere.agency = 'DSWD';
    }

    const transactions = await DistributionTransaction.findAll({
      where: { beneficiary_id: beneficiary.id },
      include: [
        {
          model: DistributionEvent,
          as: 'Event',
          where: Object.keys(eventWhere).length > 0 ? eventWhere : undefined,
          required: Object.keys(eventWhere).length > 0,
          include: [
            {
              model: BenefitProgram,
              as: 'Program',
              attributes: ['id', 'name', 'code', 'benefit_type', 'agency'],
            },
            {
              model: Barangay,
              attributes: ['id', 'barangay_name'],
            },
          ],
        },
        {
          model: User,
          as: 'ReleasedByStaff',
          attributes: ['id', 'first_name', 'last_name', 'role'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const releasedList = transactions.filter((t) => t.status === 'released');
    const pendingList = transactions.filter((t) => t.status === 'pending');
    const totalAmountClaimed = releasedList.reduce((sum, t) => sum + parseFloat(t.amount || 0) + parseFloat(t.retro_amount || 0), 0);
    const totalAmountPending = pendingList.reduce((sum, t) => sum + parseFloat(t.amount || 0) + parseFloat(t.retro_amount || 0), 0);

    const stats = {
      total_claims: transactions.length,
      released_count: releasedList.length,
      pending_count: pendingList.length,
      failed_count: transactions.filter((t) => t.status === 'failed' || t.status === 'cancelled').length,
      total_amount_claimed: totalAmountClaimed,
      total_amount_pending: totalAmountPending,
      last_claim_date: releasedList[0]?.released_at || releasedList[0]?.created_at || null,
    };

    res.json({
      success: true,
      data: {
        transactions,
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /:id/enrollments ── Beneficiary Enrolled Programs & Stats
router.get('/:id/enrollments', authorize('admin', 'staff', 'barangay', 'mswdo_admin', 'beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findByPk(req.params.id, {
      include: [
        { model: Barangay, attributes: ['id', 'barangay_name'] },
        { model: User, attributes: ['id', 'first_name', 'last_name', 'email'] },
      ],
    });

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    // Scoping check for beneficiary role
    if (req.user.role === 'beneficiary') {
      const ownBen = await Beneficiary.findOne({ where: { user_id: req.user.id } });
      if (!ownBen || ownBen.id !== beneficiary.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized: You can only view your own enrollment records.' });
      }
    }

    // Barangay verification scoping check
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && req.user.barangay_id && beneficiary.barangay_id !== req.user.barangay_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only view enrollments for beneficiaries in your own Barangay' });
    }

    // Agency-level scoping:
    // MSWDO Admin can ONLY access programs under MSWDO; DSWD Admin sees DSWD; Staff sees both
    const programWhere = {};
    if (isMswdoRole(req.user.role)) {
      programWhere.agency = 'MSWDO';
    } else if (req.user.role === 'admin') {
      programWhere.agency = 'DSWD';
    }

    const enrollments = await Enrollment.findAll({
      where: { beneficiary_id: beneficiary.id },
      include: [
        {
          model: BenefitProgram,
          where: Object.keys(programWhere).length > 0 ? programWhere : undefined,
          required: Object.keys(programWhere).length > 0,
          include: [
            {
              model: Barangay,
              attributes: ['id', 'barangay_name'],
            },
          ],
        },
      ],
      order: [['enrollment_date', 'DESC'], ['created_at', 'DESC']],
    });

    const activeList = enrollments.filter((e) => e.status === 'active');
    const completedList = enrollments.filter((e) => e.status === 'completed');
    const pendingList = enrollments.filter((e) => e.status === 'pending');

    const stats = {
      total_enrolled: enrollments.length,
      active_count: activeList.length,
      completed_count: completedList.length,
      pending_count: pendingList.length,
      cancelled_count: enrollments.filter((e) => e.status === 'cancelled').length,
    };

    res.json({
      success: true,
      data: {
        enrollments,
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update application status to Under Review (Admin only) — MSWDO limited to Senior/PWD
router.put('/applications/:id/review', authorize('admin'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findByPk(req.params.id);
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (isMswdoRole(req.user.role) && !isMswdoCategory(beneficiary.category)) {
      return res.status(403).json({ success: false, message: 'MSWDO can only review Senior Citizens and PWD applications. 4Ps applications must be reviewed by DSWD.' });
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

// Approve application (Admin only) — MSWDO limited to Senior/PWD
router.post('/applications/:id/approve', authorize('admin'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findByPk(req.params.id);
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (isMswdoRole(req.user.role) && !isMswdoCategory(beneficiary.category)) {
      return res.status(403).json({ success: false, message: 'MSWDO can only approve Senior Citizens and PWD applications. 4Ps applications must be approved by DSWD.' });
    }

    const is4Ps = (beneficiary.category || '').toLowerCase().includes('4ps');
    let customId;
    if (is4Ps) {
      // For 4Ps beneficiaries, their beneficiary number is their Household Number
      customId = beneficiary.household_id_number || beneficiary.beneficiary_id_code || req.body.household_id_number;
      if (!customId) {
        const currentYear = new Date().getFullYear();
        const count = await Beneficiary.count({
          where: {
            beneficiary_id_code: {
              [Op.like]: `4PS-${currentYear}-%`
            }
          }
        });
        const suffix = String(count + 1).padStart(4, '0');
        customId = `4PS-${currentYear}-${suffix}`;
      }
    } else {
      // For Senior and PWD beneficiaries, use standard Beneficiary Number (BEN-YYYY-XXXX)
      const currentYear = new Date().getFullYear();
      const count = await Beneficiary.count({
        where: {
          beneficiary_id_code: {
            [Op.like]: `BEN-${currentYear}-%`
          }
        }
      });
      const suffix = String(count + 1).padStart(4, '0');
      customId = `BEN-${currentYear}-${suffix}`;
    }

    await beneficiary.update({
      status: 'Approved',
      beneficiary_id_code: customId,
      household_id_number: is4Ps ? customId : null,
      approval_date: new Date(),
      approving_staff_id: req.user.id,
      rejection_reason: null,
      missing_documents: null
    });

    // Log action to audit trail
    await AuditLog.create({
      user_id: req.user.id,
      action: `Approved application for ${beneficiary.first_name} ${beneficiary.last_name}. Assigned ${is4Ps ? 'Household Number' : 'Beneficiary ID'}: ${customId}`,
      module: 'Beneficiary Review'
    });

    // Notify beneficiary
    await SMSNotification.create({
      beneficiary_id: beneficiary.id,
      message: is4Ps
        ? `Your 4Ps application has been approved! Your Household Number is ${customId}.`
        : `Your application has been approved! Your Beneficiary ID is ${customId}.`,
      status: 'sent',
      sent_at: new Date()
    });

    res.json({ success: true, message: 'Application approved successfully', data: beneficiary });
  } catch (error) {
    next(error);
  }
});

// Reject application (Admin only) — MSWDO limited to Senior/PWD
router.post('/applications/:id/reject', authorize('admin'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findByPk(req.params.id);
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (isMswdoRole(req.user.role) && !isMswdoCategory(beneficiary.category)) {
      return res.status(403).json({ success: false, message: 'MSWDO can only reject Senior Citizens and PWD applications. 4Ps applications must be handled by DSWD.' });
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
    // MSWDO scope: Senior/PWD only
    if (isMswdoRole(req.user.role) && !isMswdoCategory(beneficiary.category)) {
      return res.status(403).json({ success: false, message: 'MSWDO can only edit Senior Citizens and PWD beneficiaries. 4Ps beneficiaries are managed by DSWD.' });
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

    // If household_id_number updated for 4Ps, also sync beneficiary_id_code
    if (otherUpdates.household_id_number !== undefined) {
      const is4Ps = (otherUpdates.category || beneficiary.category || '').toLowerCase().includes('4ps');
      if (is4Ps && otherUpdates.household_id_number) {
        otherUpdates.beneficiary_id_code = String(otherUpdates.household_id_number).trim();
      }
    }

    // Only Admin can register or update RFID numbers
    if (otherUpdates.RFID_number !== undefined && !['admin','mswdo_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Only administrators can register or update RFID numbers' });
    }

    // If payout account details changed, reset verification status
    if (otherUpdates.payout_account_number !== undefined || otherUpdates.payout_account_name !== undefined || otherUpdates.payout_provider !== undefined) {
      // Only reset if the actual values changed
      const accountChanged = (otherUpdates.payout_account_number && otherUpdates.payout_account_number !== beneficiary.payout_account_number)
        || (otherUpdates.payout_account_name && otherUpdates.payout_account_name !== beneficiary.payout_account_name)
        || (otherUpdates.payout_provider && otherUpdates.payout_provider !== beneficiary.payout_provider);
      
      if (accountChanged) {
        otherUpdates.account_verification_status = 'unverified';
        otherUpdates.account_verified_at = null;
        console.log(`[UPDATE BENEFICIARY] Payout account changed - resetting verification status`);
      }
    }

    // If switching to cash_otc, clear digital payout fields
    if (otherUpdates.payout_preference === 'cash_otc') {
      otherUpdates.payout_provider = null;
      otherUpdates.payout_account_number = null;
      otherUpdates.payout_account_name = null;
      otherUpdates.account_verification_status = 'unverified';
      otherUpdates.account_verified_at = null;
    }

    // Update beneficiary with remaining fields (RFID_number, payout details, etc.)
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

// ── POST /:id/verify-payout-account ── Verify beneficiary's payout account via name-matching (DSWD Admin only)
router.post('/:id/verify-payout-account', authorize('admin'), async (req, res, next) => {
  try {
    console.log(`[VERIFY PAYOUT] Request for beneficiary ID: ${req.params.id}, by user: ${req.user.id} (${req.user.role})`);

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access Denied: Only DSWD Administrator can verify or manage payout accounts.' });
    }

    const beneficiary = await Beneficiary.findByPk(req.params.id, { include: [User] });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    // Must have digital payout preference
    if (beneficiary.payout_preference !== 'digital') {
      return res.status(400).json({
        success: false,
        message: 'This beneficiary uses Cash OTC / RFID payout. Switch to Digital payout first before verifying.',
      });
    }

    // Must have account details filled
    if (!beneficiary.payout_provider || !beneficiary.payout_account_number || !beneficiary.payout_account_name) {
      return res.status(400).json({
        success: false,
        message: 'Incomplete payout details. Please fill in Provider, Account Number, and Account Name first.',
      });
    }

    // ── ACTION: UNVERIFY / REVERT TO PENDING ──
    if (req.body?.action === 'unverify') {
      await beneficiary.update({
        account_verification_status: 'unverified',
        account_verified_at: null,
      });

      await AuditLog.create({
        user_id: req.user.id,
        action: `Unverified payout account for beneficiary ${beneficiary.first_name} ${beneficiary.last_name}`,
        module: 'Payout Settings'
      });

      return res.json({
        success: true,
        message: 'Na-unverify na ang payout account. Nakabinbin na ito muli para sa pagsusuri.',
        data: { status: 'unverified' }
      });
    }

    // ── ACTION: REJECT PAYOUT ACCOUNT ──
    if (req.body?.action === 'reject') {
      await beneficiary.update({
        account_verification_status: 'rejected',
        account_verified_at: null,
      });

      if (beneficiary.user_id) {
        try {
          const maskedNumber = beneficiary.payout_account_number && beneficiary.payout_account_number.length > 7
            ? beneficiary.payout_account_number.replace(/(.{4})(.*)(.{3})/, '$1****$3')
            : beneficiary.payout_account_number;

          await Notification.create({
            user_id: beneficiary.user_id,
            title: '⚠️ May Puna sa Iyong Payout Account',
            message: `Ang iyong rehistradong ${beneficiary.payout_provider || 'E-Wallet'} account (${maskedNumber}) ay tinanggihan ng Admin dahil sa magkaibang contact number o maling impormasyon.\n\nMangyaring i-update ang tamang detalye sa iyong portal dashboard.`,
            type: 'system',
            reference_id: beneficiary.id,
            reference_type: 'payout_rejected',
            is_read: false
          });
        } catch (e) {}
      }

      await AuditLog.create({
        user_id: req.user.id,
        action: `Rejected payout account for beneficiary ${beneficiary.first_name} ${beneficiary.last_name}`,
        module: 'Payout Settings'
      });

      return res.json({
        success: true,
        message: 'Tinanggihan ang payout account. Naabisuhan ang benepisyaryo na mag-update.',
        data: { status: 'rejected' }
      });
    }

    // ── ACTION: SYNC PHONE NUMBER ──
    if (req.body?.action === 'sync_phone') {
      const newPhone = beneficiary.payout_account_number;
      await beneficiary.update({
        contact_number: newPhone
      });
      if (beneficiary.User) {
        await beneficiary.User.update({ contact_number: newPhone });
      }

      await AuditLog.create({
        user_id: req.user.id,
        action: `Synced official contact number of beneficiary ${beneficiary.first_name} ${beneficiary.last_name} to match payout number (${newPhone})`,
        module: 'Beneficiary Management'
      });

      return res.json({
        success: true,
        message: `Matagumpay na na-update ang opisyal na Contact Number sa ${newPhone}.`,
        data: { contact_number: newPhone }
      });
    }

    // ── Automated Name-Matching ──
    // Compare the beneficiary's registered name (DSWD record) with the payout account holder name
    const dswdName = `${beneficiary.first_name} ${beneficiary.last_name}`.toLowerCase().replace(/\s+/g, ' ').trim();
    const accountName = beneficiary.payout_account_name.toLowerCase().replace(/\s+/g, ' ').trim();

    // Calculate similarity (simple token-based matching)
    const dswdTokens = dswdName.split(' ');
    const accountTokens = accountName.split(' ');
    let matchedTokens = 0;
    for (const token of dswdTokens) {
      if (accountTokens.some(at => at === token || at.includes(token) || token.includes(at))) {
        matchedTokens++;
      }
    }
    const matchScore = dswdTokens.length > 0 ? (matchedTokens / dswdTokens.length) * 100 : 0;

    console.log(`[VERIFY PAYOUT] Name matching:`, {
      dswd_name: dswdName,
      account_name: accountName,
      match_score: matchScore,
    });

    // Require at least 80% token match for auto-verification
    // Admin can also force-verify via the { force: true } body parameter
    const forceVerify = req.body?.force === true;

    if (matchScore >= 80 || forceVerify) {
      await beneficiary.update({
        account_verification_status: 'verified',
        account_verified_at: new Date(),
      });

      console.log(`[VERIFY PAYOUT] Account VERIFIED (score: ${matchScore}%, forced: ${forceVerify})`);

      // ── NOTIFY BENEFICIARY OF APPROVAL ──
      if (beneficiary.user_id) {
        try {
          const maskedNumber = beneficiary.payout_account_number && beneficiary.payout_account_number.length > 7
            ? beneficiary.payout_account_number.replace(/(.{4})(.*)(.{3})/, '$1****$3')
            : beneficiary.payout_account_number;

          await Notification.create({
            user_id: beneficiary.user_id,
            title: '✅ Na-aprubahan ang Iyong Digital Payout Account!',
            message: `Magandang balita! Ang iyong rehistradong ${beneficiary.payout_provider || 'E-Wallet'} account (${maskedNumber}) sa ilalim ng pangalang "${beneficiary.payout_account_name}" ay opisyal nang na-verify at na-aprubahan ng Admin.\n\nHanda na itong gamitin para sa mga darating na digital ayuda disbursements.`,
            type: 'system',
            reference_id: beneficiary.id,
            reference_type: 'payout_verified',
            is_read: false
          });

          if (beneficiary.contact_number) {
            await SMSNotification.create({
              beneficiary_id: beneficiary.id,
              message: `DSWD EBMS: Magandang araw! Na-aprubahan na ng Admin ang iyong ${beneficiary.payout_provider || 'E-Wallet'} account (${maskedNumber}). Handa na ito para sa digital ayuda disbursement.`,
              status: 'sent',
              sent_at: new Date()
            });
          }

          console.log(`[PAYOUT VERIFY NOTIF] Beneficiary user ${beneficiary.user_id} notified of approval`);
        } catch (notifErr) {
          console.error('[PAYOUT VERIFY NOTIF ERROR]', notifErr);
        }
      }

      await AuditLog.create({
        user_id: req.user.id,
        action: `Verified payout account for beneficiary ${beneficiary.first_name} ${beneficiary.last_name} (${beneficiary.payout_provider}: ${beneficiary.payout_account_number})`,
        module: 'Payout Settings'
      });

      return res.json({
        success: true,
        message: forceVerify
          ? `Account manually verified by admin (name match: ${matchScore.toFixed(0)}%).`
          : `Account verified! Name match: ${matchScore.toFixed(0)}%. "${dswdName}" ↔ "${accountName}".`,
        data: {
          status: 'verified',
          match_score: matchScore,
          dswd_name: `${beneficiary.first_name} ${beneficiary.last_name}`,
          account_name: beneficiary.payout_account_name,
          verified_at: new Date(),
        },
      });
    } else {
      // Name mismatch - set to rejected but don't block admin from force-verifying
      await beneficiary.update({
        account_verification_status: 'rejected',
        account_verified_at: null,
      });

      console.log(`[VERIFY PAYOUT] Account REJECTED (score: ${matchScore}%)`);

      // ── NOTIFY BENEFICIARY OF REJECTION / MISMATCH ──
      if (beneficiary.user_id) {
        try {
          const maskedNumber = beneficiary.payout_account_number && beneficiary.payout_account_number.length > 7
            ? beneficiary.payout_account_number.replace(/(.{4})(.*)(.{3})/, '$1****$3')
            : beneficiary.payout_account_number;

          await Notification.create({
            user_id: beneficiary.user_id,
            title: '⚠️ May Puna sa Iyong Payout Account',
            message: `Ang iyong rehistradong ${beneficiary.payout_provider || 'E-Wallet'} account (${maskedNumber}) ay hindi na-verify dahil hindi tumutugma ang account name ("${beneficiary.payout_account_name}") sa iyong opisyal na DSWD record name ("${beneficiary.first_name} ${beneficiary.last_name}").\n\nMangyaring i-update ang tamang impormasyon sa iyong portal dashboard.`,
            type: 'system',
            reference_id: beneficiary.id,
            reference_type: 'payout_rejected',
            is_read: false
          });

          if (beneficiary.contact_number) {
            await SMSNotification.create({
              beneficiary_id: beneficiary.id,
              message: `DSWD EBMS: Ang iyong ${beneficiary.payout_provider || 'E-Wallet'} account ay may mismatch sa opisyal na pangalan. Mangyaring bisitahin ang portal upang i-update ang iyong impormasyon.`,
              status: 'sent',
              sent_at: new Date()
            });
          }

          console.log(`[PAYOUT REJECT NOTIF] Beneficiary user ${beneficiary.user_id} notified of rejection`);
        } catch (notifErr) {
          console.error('[PAYOUT REJECT NOTIF ERROR]', notifErr);
        }
      }

      await AuditLog.create({
        user_id: req.user.id,
        action: `Payout account verification rejected for beneficiary ${beneficiary.first_name} ${beneficiary.last_name} due to name mismatch`,
        module: 'Payout Settings'
      });

      return res.json({
        success: false,
        message: `Name mismatch! DSWD record: "${beneficiary.first_name} ${beneficiary.last_name}" vs Account name: "${beneficiary.payout_account_name}" (Match: ${matchScore.toFixed(0)}%). You can force-verify if you have manually confirmed the identity.`,
        data: {
          status: 'rejected',
          match_score: matchScore,
          dswd_name: `${beneficiary.first_name} ${beneficiary.last_name}`,
          account_name: beneficiary.payout_account_name,
        },
      });
    }
  } catch (error) {
    console.error(`[VERIFY PAYOUT] Error:`, error);
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
    // MSWDO scope: Senior/PWD only
    if (isMswdoRole(req.user.role) && !isMswdoCategory(beneficiary.category)) {
      return res.status(403).json({ success: false, message: 'MSWDO can only delete Senior Citizens and PWD beneficiaries. 4Ps beneficiaries are managed by DSWD.' });
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
