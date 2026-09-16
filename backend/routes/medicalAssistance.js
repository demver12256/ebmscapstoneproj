const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  MedicalAssistanceApplication,
  MedicalAssistanceDocument,
  AssistanceRequest,
  Beneficiary,
  User,
  Barangay,
  Notification,
  AuditLog,
} = require('../db');

const router = express.Router();

// Configure multer storage for medical assistance documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/documents/medical');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'med-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed formats: JPG, PNG, WebP, PDF.'));
    }
  },
});

const IMMEDIATE_FAMILY_RELATIONS = ['Mother', 'Father', 'Son', 'Daughter', 'Sibling'];

/**
 * Determine dynamic list of required documents based on application data
 */
const computeRequiredDocuments = (app) => {
  const reqs = [];

  const isImmediate = IMMEDIATE_FAMILY_RELATIONS.includes(app.applicant_relationship);

  // 1. Identification requirement
  if (isImmediate) {
    reqs.push({
      code: 'valid_id',
      name: 'Valid ID of Immediate Family Member (Back-to-Back)',
      description: `Two (2) photocopies of valid ID (back-to-back) of the immediate family member (${app.applicant_relationship}) processing the assistance.`,
      mandatory: true,
      category: 'Identification',
    });
  } else {
    reqs.push({
      code: 'rep_valid_id',
      name: "Representative's Valid ID (Back-to-Back)",
      description: 'Valid ID of authorized non-immediate representative processing the request.',
      mandatory: true,
      category: 'Identification',
    });
    reqs.push({
      code: 'rep_patient_id',
      name: "Patient's or Partner's ID with Three (3) Signatures",
      description: 'One (1) photocopy of the Patient\'s or Partner\'s ID containing three specimen signatures.',
      mandatory: true,
      category: 'Representative Validation',
    });
    reqs.push({
      code: 'rep_auth_letter',
      name: 'Authorization Letter from Patient or Partner',
      description: 'Formal signed authorization letter designating the representative to process assistance.',
      mandatory: true,
      category: 'Representative Validation',
    });
    reqs.push({
      code: 'rep_brgy_cert',
      name: 'Barangay Certification (Living Together or Authorization)',
      description: 'Barangay Certification confirming that the representative is living with the patient as common-law partner or authorized to represent.',
      mandatory: true,
      category: 'Representative Validation',
    });
  }

  // 2. Medical Certificate (applicable for Medical and Hospital categories)
  if (
    app.category === 'Medical Assistance' ||
    app.category === 'Medicines Assistance' ||
    app.category === 'Laboratory Assistance' ||
    app.category === 'Hospital Assistance' ||
    app.category === 'Hospital Bill Assistance'
  ) {
    reqs.push({
      code: 'medical_certificate',
      name: 'Original Medical Certificate',
      description: "Must contain patient's full name, attending doctor's signature, license number, and issue date.",
      mandatory: true,
      category: 'Medical Documents',
    });
  }

  // 3. Category Specific Rules
  if (app.category === 'Medical Assistance' || app.category === 'Medicines Assistance') {
    reqs.push({
      code: 'prescription',
      name: 'Doctor’s Prescription',
      description: 'One (1) photocopy of valid prescription with doctor’s details and dosage.',
      mandatory: true,
      category: 'Medicines Requirement',
    });
    reqs.push({
      code: 'price_quotation',
      name: 'Official Price Quotation from Authorized Pharmacy',
      description: `Official Price Quotation from an accredited pharmacy (e.g. ${app.pharmacy_name || 'Oriental 21 Pharmacy, Generika Drugstore, or accredited pharmacy'}).`,
      mandatory: true,
      category: 'Medicines Requirement',
    });
  } else if (app.category === 'Laboratory Assistance') {
    reqs.push({
      code: 'lab_request',
      name: 'Photocopy of Laboratory Request',
      description: 'Physician’s diagnostic/laboratory procedure request form.',
      mandatory: true,
      category: 'Laboratory Requirement',
    });
    if (app.lab_requires_payment) {
      reqs.push({
        code: 'price_quotation',
        name: 'Price Quotation for Laboratory Procedure',
        description: 'Quotation or fee breakdown from diagnostic laboratory or hospital.',
        mandatory: true,
        category: 'Laboratory Requirement',
      });
    }
    if (app.lab_guarantee_letter_facility) {
      reqs.push({
        code: 'acceptance_letter',
        name: 'Facility Acceptance Letter for Guarantee Letter (GL)',
        description: 'Letter confirming laboratory or hospital facility accepts DSWD Guarantee Letter arrangement.',
        mandatory: true,
        category: 'Laboratory Requirement',
      });
    }
  } else if (app.category === 'Hospital Assistance' || app.category === 'Hospital Bill Assistance') {
    // Clinical abstract check
    if (app.had_surgical_operation) {
      reqs.push({
        code: 'clinical_abstract',
        name: 'Original Clinical Abstract',
        description: 'Required because patient underwent operation, surgical procedure, or other major medical procedure.',
        mandatory: true,
        category: 'Hospital Documents',
      });
    }

    if (app.hospital_confinement_status === 'currently_confined') {
      reqs.push({
        code: 'hospital_up_to_present',
        name: 'Hospital Statement / Records Marked "UP TO PRESENT"',
        description: 'Patient is currently confined. All available billing records marked "UP TO PRESENT". Final bill may not yet be available.',
        mandatory: true,
        category: 'Hospital Documents',
      });
    } else if (app.hospital_confinement_status === 'discharged_with_balance') {
      reqs.push({
        code: 'final_hospital_bill',
        name: 'Final Hospital Bill (With Deductions)',
        description: 'Final statement showing PhilHealth/HMO and other agency assistance deductions.',
        mandatory: true,
        category: 'Hospital Documents',
      });
      reqs.push({
        code: 'promissory_note',
        name: 'Promissory Note',
        description: 'Signed promissory note executed with hospital billing office.',
        mandatory: true,
        category: 'Discharge Requirements',
      });
      reqs.push({
        code: 'certificate_of_balance',
        name: 'Certificate of Balance',
        description: 'Official Certificate of Balance issued by hospital cashier or credit office.',
        mandatory: true,
        category: 'Discharge Requirements',
      });
    } else if (app.hospital_confinement_status === 'discharged_outstanding') {
      reqs.push({
        code: 'final_hospital_bill',
        name: 'Final Hospital Bill (With Deductions)',
        description: 'Final statement showing PhilHealth/HMO and other agency assistance deductions.',
        mandatory: true,
        category: 'Hospital Documents',
      });
      reqs.push({
        code: 'certificate_of_balance',
        name: 'Certificate of Balance',
        description: 'Official Certificate of Balance issued by hospital cashier or credit office.',
        mandatory: true,
        category: 'Discharge Requirements',
      });
    } else {
      reqs.push({
        code: 'final_hospital_bill',
        name: 'Final Hospital Bill',
        description: 'Itemized hospital statement showing deductions and remaining balance.',
        mandatory: true,
        category: 'Hospital Documents',
      });
    }
  } else if (app.category === 'Educational Assistance') {
    reqs.push({
      code: 'certificate_of_enrollment',
      name: 'Certificate of Enrollment / Registration (COR)',
      description: 'Official enrollment certification or validated registration form for the current academic term.',
      mandatory: true,
      category: 'Academic Documents',
    });
    reqs.push({
      code: 'school_id',
      name: 'Valid School ID of Student (Front and Back)',
      description: 'Clear photocopy of the student’s validated school ID.',
      mandatory: true,
      category: 'Academic Documents',
    });
    reqs.push({
      code: 'assessment_of_fees',
      name: 'Statement of Account / Assessment of Fees',
      description: 'Official statement of account, tuition breakdown, or school fee assessment from registrar.',
      mandatory: true,
      category: 'Academic Documents',
    });
    reqs.push({
      code: 'brgy_indigency_student',
      name: 'Barangay Certificate of Indigency',
      description: 'Barangay Indigency certifying that the student belongs to an indigent or low-income household.',
      mandatory: true,
      category: 'Government Certifications',
    });
  } else if (app.category === 'Financial Assistance') {
    reqs.push({
      code: 'brgy_indigency_financial',
      name: 'Barangay Certificate of Indigency',
      description: 'Recent Barangay Indigency certifying claimant as indigent or in crisis.',
      mandatory: true,
      category: 'Government Certifications',
    });
    reqs.push({
      code: 'case_study_justification',
      name: 'Letter of Intent / Justification / Social Case Study',
      description: 'Formal statement stating emergency financial need, crisis situation, and purpose of financial grant.',
      mandatory: true,
      category: 'Social Assessment',
    });
  } else if (app.category === 'Burial Assistance') {
    reqs.push({
      code: 'death_certificate',
      name: 'Registered Certificate of Death (PSA or Local Civil Registrar)',
      description: 'Certified True Copy or PSA/Local Civil Registrar copy of the deceased’s Death Certificate.',
      mandatory: true,
      category: 'Civil Registry Documents',
    });
    reqs.push({
      code: 'funeral_contract',
      name: 'Funeral Contract / Statement of Account from Mortuary',
      description: 'Official funeral contract, casket billing, or balance statement from accredited funeral home.',
      mandatory: true,
      category: 'Burial Documents',
    });
    reqs.push({
      code: 'brgy_indigency_burial',
      name: 'Barangay Certificate of Indigency of Claimant',
      description: 'Certifying claimant’s indigent status and relationship to the deceased.',
      mandatory: true,
      category: 'Government Certifications',
    });
  }

  // 4. District Referral letter if office requested it
  if (app.has_district_referral) {
    reqs.push({
      code: 'district_referral',
      name: 'Referral Letter from 2nd District Office',
      description: 'Official referral document issued by the 2nd Congressional District.',
      mandatory: true,
      category: 'Government Endorsements',
    });
  }

  return reqs;
};

// Helper to generate next application number
const generateApplicationNumber = async () => {
  const year = new Date().getFullYear();
  const count = await MedicalAssistanceApplication.count();
  const sequence = String(count + 1).padStart(5, '0');
  return `DSWD-MED-${year}-${sequence}`;
};

// Helper to get effective barangay id
const getUserBarangayId = async (user) => {
  if (user.barangay_id) return user.barangay_id;
  if (user.role === 'beneficiary') {
    const ben = await Beneficiary.findOne({ where: { user_id: user.id } });
    if (ben && ben.barangay_id) return ben.barangay_id;
  }
  return null;
};

router.use(authenticate);

// ─────────────────────────────────────────────────────────────
// 1. Dynamic Requirements Specification (Public to authenticated)
// ─────────────────────────────────────────────────────────────
router.post('/requirements-matrix', (req, res) => {
  const reqs = computeRequiredDocuments(req.body);
  res.json({ success: true, data: reqs });
});

// ─────────────────────────────────────────────────────────────
// 2. Beneficiary Routes
// ─────────────────────────────────────────────────────────────

// GET /api/medical-assistance/my-applications
router.get('/my-applications', authorize('beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary record not found.' });
    }

    const applications = await MedicalAssistanceApplication.findAll({
      where: { beneficiary_id: beneficiary.id },
      include: [
        { model: MedicalAssistanceDocument, as: 'Documents' },
        { model: Barangay, attributes: ['id', 'barangay_name'] },
        { model: User, as: 'Reviewer', attributes: ['id', 'first_name', 'last_name'] },
      ],
      order: [['created_at', 'DESC']],
    });

    const enriched = applications.map((app) => {
      const plain = app.toJSON();
      const required = computeRequiredDocuments(plain);
      const uploadedCodes = (plain.Documents || []).map((d) => d.document_code);
      const missing = required.filter((r) => !uploadedCodes.includes(r.code));
      plain.required_documents = required;
      plain.missing_documents = missing;
      plain.total_required = required.length;
      plain.total_uploaded = uploadedCodes.length;
      plain.is_complete = missing.length === 0;
      return plain;
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
});

// GET /api/medical-assistance/my-applications/:id
router.get('/my-applications/:id', authorize('beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary record not found.' });
    }

    const application = await MedicalAssistanceApplication.findOne({
      where: { id: req.params.id, beneficiary_id: beneficiary.id },
      include: [
        { model: MedicalAssistanceDocument, as: 'Documents' },
        { model: Barangay, attributes: ['id', 'barangay_name'] },
        { model: User, as: 'Reviewer', attributes: ['id', 'first_name', 'last_name'] },
      ],
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const plain = application.toJSON();
    const required = computeRequiredDocuments(plain);
    const uploadedCodes = (plain.Documents || []).map((d) => d.document_code);
    const missing = required.filter((r) => !uploadedCodes.includes(r.code));
    plain.required_documents = required;
    plain.missing_documents = missing;
    plain.total_required = required.length;
    plain.total_uploaded = uploadedCodes.length;
    plain.is_complete = missing.length === 0;

    res.json({ success: true, data: plain });
  } catch (error) {
    next(error);
  }
});

// POST /api/medical-assistance/save-draft
router.post('/save-draft', authorize('beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary record not found.' });
    }

    const {
      id,
      category,
      patient_name,
      patient_gender,
      patient_dob,
      patient_contact,
      patient_address,
      hospital_or_clinic_name,
      diagnosis,
      attending_physician,
      applicant_relationship,
      representative_name,
      representative_contact,
      has_district_referral,
      pharmacy_name,
      lab_procedure_name,
      lab_requires_payment,
      lab_guarantee_letter_facility,
      hospital_confinement_status,
      had_surgical_operation,
      total_amount_requested,
    } = req.body;

    if (!category) {
      return res.status(400).json({ success: false, message: 'Assistance category is required.' });
    }

    const isImmediate = IMMEDIATE_FAMILY_RELATIONS.includes(applicant_relationship);

    let application;
    if (id) {
      application = await MedicalAssistanceApplication.findOne({
        where: { id, beneficiary_id: beneficiary.id },
      });
      if (!application) {
        return res.status(404).json({ success: false, message: 'Application draft not found.' });
      }
      if (!['Draft', 'Incomplete', 'For Additional Requirements'].includes(application.status)) {
        return res.status(400).json({ success: false, message: 'Submitted application cannot be modified.' });
      }

      await application.update({
        category,
        patient_name: patient_name || application.patient_name,
        patient_gender,
        patient_dob: patient_dob || null,
        patient_contact,
        patient_address,
        hospital_or_clinic_name,
        diagnosis,
        attending_physician,
        applicant_relationship: applicant_relationship || application.applicant_relationship,
        is_immediate_family: isImmediate,
        representative_name,
        representative_contact,
        has_district_referral: Boolean(has_district_referral),
        pharmacy_name,
        lab_procedure_name,
        lab_requires_payment: lab_requires_payment !== undefined ? Boolean(lab_requires_payment) : true,
        lab_guarantee_letter_facility: Boolean(lab_guarantee_letter_facility),
        hospital_confinement_status: hospital_confinement_status || 'not_applicable',
        had_surgical_operation: Boolean(had_surgical_operation),
        total_amount_requested: total_amount_requested || 0,
        agency: req.body.agency || application.agency || 'DSWD',
      });
    } else {
      const appNumber = await generateApplicationNumber();
      application = await MedicalAssistanceApplication.create({
        application_number: appNumber,
        beneficiary_id: beneficiary.id,
        user_id: req.user.id,
        barangay_id: beneficiary.barangay_id || 1,
        agency: req.body.agency || 'DSWD',
        category,
        patient_name: patient_name || `${beneficiary.first_name} ${beneficiary.last_name}`,
        patient_gender,
        patient_dob: patient_dob || null,
        patient_contact,
        patient_address: patient_address || beneficiary.address,
        hospital_or_clinic_name,
        diagnosis,
        attending_physician,
        applicant_relationship: applicant_relationship || 'Mother',
        is_immediate_family: isImmediate,
        representative_name,
        representative_contact,
        has_district_referral: Boolean(has_district_referral),
        pharmacy_name,
        lab_procedure_name,
        lab_requires_payment: lab_requires_payment !== undefined ? Boolean(lab_requires_payment) : true,
        lab_guarantee_letter_facility: Boolean(lab_guarantee_letter_facility),
        hospital_confinement_status: hospital_confinement_status || 'not_applicable',
        had_surgical_operation: Boolean(had_surgical_operation),
        total_amount_requested: total_amount_requested || 0,
        status: 'Draft',
      });
    }

    // Load with documents
    const fullApp = await MedicalAssistanceApplication.findByPk(application.id, {
      include: [{ model: MedicalAssistanceDocument, as: 'Documents' }],
    });

    const plain = fullApp.toJSON();
    const required = computeRequiredDocuments(plain);
    const uploadedCodes = (plain.Documents || []).map((d) => d.document_code);
    const missing = required.filter((r) => !uploadedCodes.includes(r.code));
    plain.required_documents = required;
    plain.missing_documents = missing;
    plain.total_required = required.length;
    plain.total_uploaded = uploadedCodes.length;
    plain.is_complete = missing.length === 0;

    res.json({
      success: true,
      data: plain,
      message: 'Medical assistance draft saved successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/medical-assistance/documents/upload
router.post(
  '/documents/upload',
  authorize('beneficiary'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
      if (!beneficiary) {
        return res.status(404).json({ success: false, message: 'Beneficiary record not found.' });
      }

      const { application_id, document_code, document_name } = req.body;
      if (!application_id || !document_code) {
        return res.status(400).json({ success: false, message: 'application_id and document_code are required.' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Please attach a document file (JPG, PNG, or PDF).' });
      }

      const application = await MedicalAssistanceApplication.findOne({
        where: { id: application_id, beneficiary_id: beneficiary.id },
      });

      if (!application) {
        return res.status(404).json({ success: false, message: 'Application not found.' });
      }

      if (!['Draft', 'Incomplete', 'For Additional Requirements'].includes(application.status)) {
        return res.status(400).json({ success: false, message: 'Documents cannot be altered in current application status.' });
      }

      const relativePath = `uploads/documents/medical/${req.file.filename}`;

      // Check if document of this code already exists; if so, replace it
      let doc = await MedicalAssistanceDocument.findOne({
        where: { application_id: application.id, document_code },
      });

      if (doc) {
        // Delete old file if exists
        try {
          const oldPath = path.join(__dirname, '..', doc.file_path);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch (e) {
          console.error('Error removing old file:', e);
        }

        await doc.update({
          file_path: relativePath,
          file_name: req.file.originalname,
          file_size: req.file.size,
          mime_type: req.file.mimetype,
          document_name: document_name || doc.document_name,
          status: 'Pending',
          remarks: null,
        });
      } else {
        doc = await MedicalAssistanceDocument.create({
          application_id: application.id,
          document_code,
          document_name: document_name || document_code,
          file_path: relativePath,
          file_name: req.file.originalname,
          file_size: req.file.size,
          mime_type: req.file.mimetype,
          status: 'Pending',
        });
      }

      // Check application completeness
      const allDocs = await MedicalAssistanceDocument.findAll({ where: { application_id: application.id } });
      const required = computeRequiredDocuments(application.toJSON());
      const uploadedCodes = allDocs.map((d) => d.document_code);
      const missing = required.filter((r) => !uploadedCodes.includes(r.code));

      if (missing.length > 0 && application.status === 'Draft') {
        await application.update({ status: 'Incomplete' });
      }

      res.status(201).json({
        success: true,
        data: doc,
        missing_count: missing.length,
        is_complete: missing.length === 0,
        message: 'Document uploaded successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/medical-assistance/documents/:id
router.delete('/documents/:id', authorize('beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    }

    const doc = await MedicalAssistanceDocument.findByPk(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    const app = await MedicalAssistanceApplication.findOne({
      where: { id: doc.application_id, beneficiary_id: beneficiary.id },
    });

    if (!app) {
      return res.status(403).json({ success: false, message: 'Unauthorized action.' });
    }

    if (!['Draft', 'Incomplete', 'For Additional Requirements'].includes(app.status)) {
      return res.status(400).json({ success: false, message: 'Cannot delete files in current application status.' });
    }

    // Delete file
    try {
      const fullPath = path.join(__dirname, '..', doc.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (e) {
      console.error('Error removing document file:', e);
    }

    await doc.destroy();
    await app.update({ status: 'Incomplete' });

    res.json({ success: true, message: 'Document removed successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/medical-assistance/my-applications/:id/submit
router.post('/my-applications/:id/submit', authorize('beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    }

    const application = await MedicalAssistanceApplication.findOne({
      where: { id: req.params.id, beneficiary_id: beneficiary.id },
      include: [{ model: MedicalAssistanceDocument, as: 'Documents' }],
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    if (!['Draft', 'Incomplete', 'For Additional Requirements'].includes(application.status)) {
      return res.status(400).json({ success: false, message: 'Application has already been submitted.' });
    }

    // Comprehensive validation checklist check
    const required = computeRequiredDocuments(application.toJSON());
    const uploadedCodes = (application.Documents || []).map((d) => d.document_code);
    const missing = required.filter((r) => !uploadedCodes.includes(r.code));

    if (missing.length > 0) {
      await application.update({ status: 'Incomplete' });
      return res.status(400).json({
        success: false,
        status: 'Incomplete',
        missing_documents: missing,
        message: `Cannot submit application. ${missing.length} mandatory document(s) are still missing.`,
      });
    }

    // All documents are complete! Advance to Pending Review
    await application.update({
      status: 'Pending Review',
      rejection_reason: null,
      additional_requirements_notes: null,
    });

    // Automatically sync into unified AssistanceRequest
    try {
      await AssistanceRequest.create({
        beneficiary_id: application.beneficiary_id,
        user_id: req.user.id,
        barangay_id: application.barangay_id,
        agency: application.agency || 'DSWD',
        type: application.category,
        subject: `${application.category} (${application.application_number})`,
        description: `Patient: ${application.patient_name}\nFacility/Institution: ${application.hospital_or_clinic_name || application.pharmacy_name || 'N/A'}\nDiagnosis/Reason: ${application.diagnosis || 'N/A'}\nRequested Amount: ₱${Number(application.total_amount_requested || 0).toLocaleString('en-PH')}`,
        status: 'Pending',
        priority: 'Normal',
      });
    } catch (syncErr) {
      console.error('Failed to sync application to AssistanceRequest:', syncErr);
    }

    // Notify user
    await Notification.create({
      user_id: req.user.id,
      title: 'Medical Assistance Submitted',
      message: `Your application (${application.application_number}) for ${application.category} has been submitted and is currently Pending Review.`,
      type: 'assistance',
      link: '/dashboard/medical-assistance',
    });

    // Audit Log
    await AuditLog.create({
      user_id: req.user.id,
      action: `SUBMIT_MEDICAL_ASSISTANCE: ${application.application_number}`,
      module: 'Medical Assistance',
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: application,
      message: 'Your DSWD Medical Assistance application has been submitted successfully!',
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────
// 3. Admin / Staff Verification Routes
// ─────────────────────────────────────────────────────────────

// GET /api/medical-assistance/admin/stats
router.get('/admin/stats', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    if (req.user.role === 'mswdo_admin') {
      return res.json({ success: true, data: { statusCounts: { total: 0 }, categoryCounts: {} } });
    }

    let whereClause = {};
    if (req.user.role === 'staff' || req.user.role === 'barangay') {
      const brgyId = await getUserBarangayId(req.user);
      if (brgyId) whereClause.barangay_id = brgyId;
    }

    const statuses = [
      'Draft',
      'Incomplete',
      'Pending Review',
      'Under Verification',
      'Approved',
      'Rejected',
      'For Additional Requirements',
      'Released',
      'Archived',
    ];

    const counts = {};
    for (const s of statuses) {
      counts[s] = await MedicalAssistanceApplication.count({ where: { ...whereClause, status: s } });
    }
    counts.total = Object.values(counts).reduce((a, b) => a + b, 0);

    const categories = [
      'Medicines Assistance',
      'Laboratory Assistance',
      'Hospital Bill Assistance',
      'Educational Assistance',
      'Financial Assistance',
      'Burial Assistance',
      'Medical Assistance',
      'Hospital Assistance',
    ];
    const categoryCounts = {};
    for (const c of categories) {
      categoryCounts[c] = await MedicalAssistanceApplication.count({ where: { ...whereClause, category: c } });
    }

    res.json({ success: true, data: { statusCounts: counts, categoryCounts } });
  } catch (error) {
    next(error);
  }
});

// GET /api/medical-assistance/admin/applications
router.get('/admin/applications', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    if (req.user.role === 'mswdo_admin') {
      return res.json({ success: true, data: [] });
    }

    let whereClause = {};
    if (req.user.role === 'staff' || req.user.role === 'barangay') {
      const brgyId = await getUserBarangayId(req.user);
      if (brgyId) whereClause.barangay_id = brgyId;
    }

    if (req.query.status && req.query.status !== 'all') {
      whereClause.status = req.query.status;
    }

    if (req.query.category && req.query.category !== 'all') {
      whereClause.category = req.query.category;
    }

    if (req.query.barangay_id && req.query.barangay_id !== 'all') {
      whereClause.barangay_id = req.query.barangay_id;
    }

    if (req.query.search) {
      const term = `%${req.query.search}%`;
      whereClause[Op.or] = [
        { application_number: { [Op.like]: term } },
        { patient_name: { [Op.like]: term } },
        { representative_name: { [Op.like]: term } },
      ];
    }

    const applications = await MedicalAssistanceApplication.findAll({
      where: whereClause,
      include: [
        {
          model: Beneficiary,
          attributes: ['id', 'first_name', 'last_name', 'contact_number', 'category', 'profile_picture'],
          include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }],
        },
        { model: Barangay, attributes: ['id', 'barangay_name'] },
        { model: MedicalAssistanceDocument, as: 'Documents' },
        { model: User, as: 'BarangayVerifier', attributes: ['id', 'first_name', 'last_name', 'role'] },
        { model: User, as: 'Reviewer', attributes: ['id', 'first_name', 'last_name', 'role'] },
      ],
      order: [
        ['created_at', 'DESC'],
      ],
    });

    const enriched = applications.map((app) => {
      const plain = app.toJSON();
      const required = computeRequiredDocuments(plain);
      const uploadedCodes = (plain.Documents || []).map((d) => d.document_code);
      const missing = required.filter((r) => !uploadedCodes.includes(r.code));
      plain.required_documents = required;
      plain.missing_documents = missing;
      plain.total_required = required.length;
      plain.total_uploaded = uploadedCodes.length;
      plain.is_complete = missing.length === 0;
      return plain;
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
});

// GET /api/medical-assistance/admin/applications/:id
router.get('/admin/applications/:id', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    if (req.user.role === 'mswdo_admin') {
      return res.status(403).json({ success: false, message: 'Access Denied: DSWD Medical Assistance applications are exclusively managed by DSWD Admin.' });
    }

    const application = await MedicalAssistanceApplication.findByPk(req.params.id, {
      include: [
        {
          model: Beneficiary,
          include: [{ model: Barangay }],
        },
        { model: Barangay, attributes: ['id', 'barangay_name'] },
        { model: MedicalAssistanceDocument, as: 'Documents' },
        { model: User, as: 'BarangayVerifier', attributes: ['id', 'first_name', 'last_name', 'role'] },
        { model: User, as: 'Reviewer', attributes: ['id', 'first_name', 'last_name', 'role'] },
        { model: User, as: 'ReleasedBy', attributes: ['id', 'first_name', 'last_name', 'role'] },
      ],
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const plain = application.toJSON();
    const required = computeRequiredDocuments(plain);
    const uploadedCodes = (plain.Documents || []).map((d) => d.document_code);
    const missing = required.filter((r) => !uploadedCodes.includes(r.code));
    plain.required_documents = required;
    plain.missing_documents = missing;
    plain.total_required = required.length;
    plain.total_uploaded = uploadedCodes.length;
    plain.is_complete = missing.length === 0;

    res.json({ success: true, data: plain });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/medical-assistance/admin/applications/:id/status
router.patch('/admin/applications/:id/status', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    if (req.user.role === 'mswdo_admin') {
      return res.status(403).json({ success: false, message: 'Access Denied: MSWDO Admin cannot manage DSWD Medical Assistance applications.' });
    }

    const application = await MedicalAssistanceApplication.findByPk(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const {
      status,
      staff_remarks,
      rejection_reason,
      additional_requirements_notes,
      approved_amount,
      assistance_type_granted,
    } = req.body;

    const validStatuses = [
      'Pending Review',
      'Under Verification',
      'Under Barangay Verification',
      'Verified by Barangay',
      'Approved',
      'Rejected',
      'For Additional Requirements',
      'Released',
      'Archived',
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    // ── TWO-TIER APPROVAL HIERARCHY ──
    // Barangay Staff verifies first; only Admin has the final approval authority
    if (req.user.role === 'barangay' && (status === 'Approved' || status === 'Released')) {
      return res.status(403).json({
        success: false,
        message: 'Barangay Staff can only verify documents and endorse requests. Final approval is strictly reserved for the Administrator.',
      });
    }

    if (status === 'Rejected' && !rejection_reason) {
      return res.status(400).json({ success: false, message: 'A rejection reason is mandatory.' });
    }

    if (status === 'For Additional Requirements' && !additional_requirements_notes) {
      return res.status(400).json({ success: false, message: 'Please specify the additional requirements needed.' });
    }

    const updatePayload = {
      status,
    };

    if (status === 'Verified by Barangay') {
      updatePayload.barangay_verified_by = req.user.id;
      updatePayload.barangay_verified_at = new Date();
      updatePayload.barangay_endorsement_notes = req.body.barangay_endorsement_notes || staff_remarks || 'Endorsed by Barangay Staff for Final Admin Approval.';
    }

    if (status === 'Approved' || status === 'Rejected' || status === 'Under Verification') {
      updatePayload.reviewed_by = req.user.id;
      updatePayload.reviewed_at = new Date();
    }

    if (staff_remarks !== undefined) updatePayload.staff_remarks = staff_remarks;
    if (rejection_reason !== undefined) updatePayload.rejection_reason = rejection_reason;
    if (additional_requirements_notes !== undefined) {
      updatePayload.additional_requirements_notes = additional_requirements_notes;
    }
    if (approved_amount !== undefined) updatePayload.approved_amount = approved_amount;
    if (assistance_type_granted !== undefined) {
      updatePayload.assistance_type_granted = assistance_type_granted;
    }

    if (status === 'Released') {
      updatePayload.released_by = req.user.id;
      updatePayload.released_at = new Date();
    }

    await application.update(updatePayload);

    // Notify Beneficiary
    let notifMessage = `Your DSWD Medical Assistance application (${application.application_number}) status has been updated to ${status}.`;
    if (status === 'Approved') {
      notifMessage = `Congratulations! Your Medical Assistance application (${application.application_number}) has been APPROVED for ₱${Number(approved_amount || 0).toLocaleString('en-PH')}.`;
    } else if (status === 'Rejected') {
      notifMessage = `Your Medical Assistance application (${application.application_number}) was rejected. Reason: ${rejection_reason}`;
    } else if (status === 'For Additional Requirements') {
      notifMessage = `Action required: Additional documents requested for your application (${application.application_number}): ${additional_requirements_notes}`;
    } else if (status === 'Released') {
      notifMessage = `Your assistance grant (${application.application_number}) has been RELEASED (${assistance_type_granted || 'Grant Voucher'}).`;
    }

    const notifLink = (status === 'Approved' || status === 'Released') 
      ? '/dashboard/my-benefits' 
      : '/dashboard/request-assistance';

    await Notification.create({
      user_id: application.user_id,
      title: `Medical Assistance: ${status}`,
      message: notifMessage,
      type: 'assistance',
      link: notifLink,
    });

    // Audit Log
    await AuditLog.create({
      user_id: req.user.id,
      action: `UPDATE_MEDICAL_ASSISTANCE_${status.toUpperCase().replace(/\s+/g, '_')}: ${application.application_number}`,
      module: 'Medical Assistance',
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: application,
      message: `Application marked as ${status} successfully.`,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/medical-assistance/admin/documents/:id/review
router.patch('/admin/documents/:id/review', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const doc = await MedicalAssistanceDocument.findByPk(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    const { status, remarks } = req.body;
    const validDocStatuses = ['Pending', 'Approved', 'Rejected', 'Needs Resubmission'];
    if (!status || !validDocStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid document status value.' });
    }

    await doc.update({
      status,
      remarks: remarks || doc.remarks,
    });

    res.json({
      success: true,
      data: doc,
      message: `Document status updated to ${status}.`,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
