const {
  connectDatabase,
  BenefitProgram,
  Beneficiary,
  User,
  Barangay,
  MedicalAssistanceApplication,
  MedicalAssistanceDocument,
  Notification,
} = require('./db');
const fs = require('fs');
const path = require('path');

const seedMedicalAssistance = async () => {
  try {
    await connectDatabase();
    console.log('Database connected.');

    // Ensure documents upload directory exists
    const uploadDir = path.join(__dirname, 'uploads/documents/medical');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 1. Create dummy sample files if they don't exist
    const sampleFiles = [
      { name: 'sample-valid-id.pdf', text: 'SAMPLE VALID ID PHOTOCOPY - BACK TO BACK' },
      { name: 'sample-med-cert.pdf', text: 'SAMPLE ORIGINAL MEDICAL CERTIFICATE (SIGNED & DATED)' },
      { name: 'sample-prescription.pdf', text: 'SAMPLE DOCTORS PRESCRIPTION (AUTHORIZED)' },
      { name: 'sample-pharmacy-quote.pdf', text: 'PRICE QUOTATION - ORIENTAL 21 PHARMACY' },
      { name: 'sample-lab-request.pdf', text: 'SAMPLE LABORATORY REQUEST FORM' },
      { name: 'sample-lab-quote.pdf', text: 'SAMPLE LABORATORY PRICE QUOTATION' },
      { name: 'sample-acceptance-letter.pdf', text: 'SAMPLE GUARANTEE LETTER ACCEPTANCE' },
      { name: 'sample-hospital-present.pdf', text: 'HOSPITAL BILLING RECORD - MARKED UP TO PRESENT' },
      { name: 'sample-final-hospital-bill.pdf', text: 'SAMPLE FINAL HOSPITAL BILL (WITH PHILHEALTH DEDUCTIONS)' },
      { name: 'sample-clinical-abstract.pdf', text: 'ORIGINAL CLINICAL ABSTRACT - SURGICAL PROCEDURE' },
      { name: 'sample-promissory-note.pdf', text: 'PROMISSORY NOTE EXECUTED WITH HOSPITAL BILLING' },
      { name: 'sample-cert-balance.pdf', text: 'CERTIFICATE OF BALANCE - OUTSTANDING AMOUNT' },
      { name: 'sample-rep-id.pdf', text: 'REPRESENTATIVE VALID ID (BACK TO BACK)' },
      { name: 'sample-rep-patient-id.pdf', text: 'PATIENT ID WITH 3 SPECIMEN SIGNATURES' },
      { name: 'sample-auth-letter.pdf', text: 'FORMAL AUTHORIZATION LETTER FROM PATIENT' },
      { name: 'sample-brgy-cert.pdf', text: 'BARANGAY CERTIFICATION - COMMON LAW / AUTHORIZATION' },
    ];

    for (const f of sampleFiles) {
      const filePath = path.join(uploadDir, f.name);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000098 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n% ${f.text}`);
      }
    }

    // 2. Ensure BenefitProgram "DSWD Medical Assistance" exists
    let [program, created] = await BenefitProgram.findOrCreate({
      where: { name: 'DSWD Medical Assistance' },
      defaults: {
        code: 'DSWD-MED-ASST',
        description: 'Comprehensive medical financial assistance program covering Medicines, Diagnostic & Laboratory procedures, and Hospital Bills for indigent and vulnerable families.',
        eligibility_category: 'Medical Indigency / Vulnerable Families',
        benefit_type: 'Medical Grant & Guarantee Letter',
        eligibility_requirements: 'Valid ID (Immediate family or Authorized Rep with Brgy Cert), Original Medical Certificate, Prescription / Lab Request / Hospital Bill, and Official Quotations.',
        status: 'active',
        total_budget: 5000000.00,
        allocated_budget: 1850000.00,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      },
    });
    console.log(`DSWD Medical Assistance Program: ${created ? 'Created' : 'Already exists'}`);

    // 3. Find a beneficiary to attach applications to
    const beneficiary = await Beneficiary.findOne({
      include: [{ model: User }],
    });

    if (!beneficiary) {
      console.log('No beneficiary found in database to attach seed applications to.');
      process.exit(0);
    }

    const adminUser = await User.findOne({ where: { role: 'admin' } });

    // Check if we already seeded applications
    const existingCount = await MedicalAssistanceApplication.count();
    if (existingCount > 0) {
      console.log(`Already have ${existingCount} medical assistance application(s) seeded.`);
      process.exit(0);
    }

    console.log(`Seeding sample applications for beneficiary: ${beneficiary.first_name} ${beneficiary.last_name}`);

    // Sample 1: Medicines Assistance (Pending Review)
    const app1 = await MedicalAssistanceApplication.create({
      application_number: 'DSWD-MED-2026-00001',
      beneficiary_id: beneficiary.id,
      user_id: beneficiary.user_id,
      barangay_id: beneficiary.barangay_id || 1,
      category: 'Medicines Assistance',
      patient_name: `${beneficiary.first_name} ${beneficiary.last_name}`,
      patient_gender: beneficiary.gender || 'Female',
      patient_dob: beneficiary.birth_date || '1982-05-14',
      patient_contact: beneficiary.contact_number || '09171234567',
      patient_address: beneficiary.address || 'Poblacion, Iloilo',
      hospital_or_clinic_name: 'Western Visayas Medical Center',
      diagnosis: 'Hypertensive Cardiovascular Disease & Type 2 Diabetes Mellitus',
      attending_physician: 'Dr. Maria Santos, MD (License # 0124589)',
      applicant_relationship: 'Son',
      is_immediate_family: true,
      representative_name: 'Carlos Santos',
      representative_contact: '09189876543',
      has_district_referral: false,
      pharmacy_name: 'Oriental 21 Pharmacy',
      total_amount_requested: 12500.00,
      status: 'Pending Review',
    });

    await MedicalAssistanceDocument.bulkCreate([
      {
        application_id: app1.id,
        document_code: 'valid_id',
        document_name: 'Valid ID of Immediate Family Member (Back-to-Back)',
        file_path: 'uploads/documents/medical/sample-valid-id.pdf',
        file_name: 'son-valid-id-backtoback.pdf',
        file_size: 145000,
        mime_type: 'application/pdf',
        status: 'Pending',
      },
      {
        application_id: app1.id,
        document_code: 'medical_certificate',
        document_name: 'Original Medical Certificate',
        file_path: 'uploads/documents/medical/sample-med-cert.pdf',
        file_name: 'med-cert-dr-santos.pdf',
        file_size: 182000,
        mime_type: 'application/pdf',
        status: 'Pending',
      },
      {
        application_id: app1.id,
        document_code: 'prescription',
        document_name: 'Doctor’s Prescription',
        file_path: 'uploads/documents/medical/sample-prescription.pdf',
        file_name: 'rx-maintenance-meds.pdf',
        file_size: 110000,
        mime_type: 'application/pdf',
        status: 'Pending',
      },
      {
        application_id: app1.id,
        document_code: 'price_quotation',
        document_name: 'Official Price Quotation from Authorized Pharmacy',
        file_path: 'uploads/documents/medical/sample-pharmacy-quote.pdf',
        file_name: 'oriental-21-quotation.pdf',
        file_size: 125000,
        mime_type: 'application/pdf',
        status: 'Pending',
      },
    ]);

    // Sample 2: Laboratory Assistance (Under Verification)
    const app2 = await MedicalAssistanceApplication.create({
      application_number: 'DSWD-MED-2026-00002',
      beneficiary_id: beneficiary.id,
      user_id: beneficiary.user_id,
      barangay_id: beneficiary.barangay_id || 1,
      category: 'Laboratory Assistance',
      patient_name: 'Elena Dela Cruz',
      patient_gender: 'Female',
      patient_dob: '1960-03-22',
      patient_contact: '09201122334',
      patient_address: 'Barangay Anilao, Iloilo',
      hospital_or_clinic_name: 'QualiMed Hospital Iloilo',
      diagnosis: 'Severe Lumbar Radiculopathy rule out Herniated Disc',
      attending_physician: 'Dr. Roberto Gomez, Orthopedic Surgeon',
      applicant_relationship: 'Daughter',
      is_immediate_family: true,
      representative_name: `${beneficiary.first_name} ${beneficiary.last_name}`,
      representative_contact: beneficiary.contact_number || '09171234567',
      has_district_referral: true,
      lab_procedure_name: 'MRI Lumbar Spine with Contrast',
      lab_requires_payment: true,
      lab_guarantee_letter_facility: true,
      total_amount_requested: 18000.00,
      status: 'Under Verification',
      staff_remarks: 'Documents verified with QualiMed Diagnostic center. Guarantee Letter being prepared.',
      reviewed_by: adminUser?.id || null,
      reviewed_at: new Date(),
    });

    await MedicalAssistanceDocument.bulkCreate([
      {
        application_id: app2.id,
        document_code: 'valid_id',
        document_name: 'Valid ID of Immediate Family Member (Back-to-Back)',
        file_path: 'uploads/documents/medical/sample-valid-id.pdf',
        file_name: 'daughter-national-id.pdf',
        file_size: 154000,
        mime_type: 'application/pdf',
        status: 'Approved',
        remarks: 'Valid National ID verified.',
      },
      {
        application_id: app2.id,
        document_code: 'medical_certificate',
        document_name: 'Original Medical Certificate',
        file_path: 'uploads/documents/medical/sample-med-cert.pdf',
        file_name: 'ortho-med-cert.pdf',
        file_size: 195000,
        mime_type: 'application/pdf',
        status: 'Approved',
      },
      {
        application_id: app2.id,
        document_code: 'lab_request',
        document_name: 'Photocopy of Laboratory Request',
        file_path: 'uploads/documents/medical/sample-lab-request.pdf',
        file_name: 'mri-lumbar-request.pdf',
        file_size: 130000,
        mime_type: 'application/pdf',
        status: 'Approved',
      },
      {
        application_id: app2.id,
        document_code: 'price_quotation',
        document_name: 'Price Quotation for Laboratory Procedure',
        file_path: 'uploads/documents/medical/sample-lab-quote.pdf',
        file_name: 'qualimed-mri-quotation.pdf',
        file_size: 160000,
        mime_type: 'application/pdf',
        status: 'Approved',
      },
      {
        application_id: app2.id,
        document_code: 'acceptance_letter',
        document_name: 'Facility Acceptance Letter for Guarantee Letter (GL)',
        file_path: 'uploads/documents/medical/sample-acceptance-letter.pdf',
        file_name: 'qualimed-gl-acceptance.pdf',
        file_size: 175000,
        mime_type: 'application/pdf',
        status: 'Pending',
      },
      {
        application_id: app2.id,
        document_code: 'district_referral',
        document_name: 'Referral Letter from 2nd District Office',
        file_path: 'uploads/documents/medical/sample-acceptance-letter.pdf',
        file_name: '2nd-district-endorsement.pdf',
        file_size: 140000,
        mime_type: 'application/pdf',
        status: 'Approved',
      },
    ]);

    // Sample 3: Hospital Bill Assistance - Currently Confined (Approved)
    const app3 = await MedicalAssistanceApplication.create({
      application_number: 'DSWD-MED-2026-00003',
      beneficiary_id: beneficiary.id,
      user_id: beneficiary.user_id,
      barangay_id: beneficiary.barangay_id || 1,
      category: 'Hospital Bill Assistance',
      patient_name: 'Salvador Ramos',
      patient_gender: 'Male',
      patient_dob: '1975-08-19',
      patient_contact: '09192233445',
      patient_address: 'Barangay Anilao, Iloilo',
      hospital_or_clinic_name: 'Iloilo Doctors Hospital',
      diagnosis: 'Community Acquired Pneumonia - High Risk with Pleural Effusion',
      attending_physician: 'Dr. Antonio Reyes, Pulmonologist',
      applicant_relationship: 'Mother',
      is_immediate_family: true,
      representative_name: 'Teresa Ramos',
      representative_contact: '09193344556',
      has_district_referral: false,
      hospital_confinement_status: 'currently_confined',
      had_surgical_operation: false,
      total_amount_requested: 45000.00,
      approved_amount: 30000.00,
      assistance_type_granted: 'DSWD Guarantee Letter to Hospital',
      status: 'Approved',
      staff_remarks: 'Approved assistance of ₱30,000 for currently confined patient. UP TO PRESENT billing accepted.',
      reviewed_by: adminUser?.id || null,
      reviewed_at: new Date(),
    });

    await MedicalAssistanceDocument.bulkCreate([
      {
        application_id: app3.id,
        document_code: 'valid_id',
        document_name: 'Valid ID of Immediate Family Member (Back-to-Back)',
        file_path: 'uploads/documents/medical/sample-valid-id.pdf',
        file_name: 'mother-valid-id.pdf',
        file_size: 148000,
        mime_type: 'application/pdf',
        status: 'Approved',
      },
      {
        application_id: app3.id,
        document_code: 'medical_certificate',
        document_name: 'Original Medical Certificate',
        file_path: 'uploads/documents/medical/sample-med-cert.pdf',
        file_name: 'pulmonary-med-cert.pdf',
        file_size: 172000,
        mime_type: 'application/pdf',
        status: 'Approved',
      },
      {
        application_id: app3.id,
        document_code: 'hospital_up_to_present',
        document_name: 'Hospital Statement / Records Marked "UP TO PRESENT"',
        file_path: 'uploads/documents/medical/sample-hospital-present.pdf',
        file_name: 'hospital-statement-up-to-present.pdf',
        file_size: 215000,
        mime_type: 'application/pdf',
        status: 'Approved',
        remarks: 'Confirmed patient currently admitted in Room 314.',
      },
    ]);

    // Sample 4: Hospital Bill Assistance - Non-Immediate Family & Discharged with Balance (For Additional Requirements)
    const app4 = await MedicalAssistanceApplication.create({
      application_number: 'DSWD-MED-2026-00004',
      beneficiary_id: beneficiary.id,
      user_id: beneficiary.user_id,
      barangay_id: beneficiary.barangay_id || 1,
      category: 'Hospital Bill Assistance',
      patient_name: 'Eduardo Fernandez',
      patient_gender: 'Male',
      patient_dob: '1970-11-05',
      patient_contact: '09178889999',
      patient_address: 'Barangay Anilao, Iloilo',
      hospital_or_clinic_name: 'The Medical City Iloilo',
      diagnosis: 'Acute Appendicitis status post Emergency Laparoscopic Appendectomy',
      attending_physician: 'Dr. Ferdinand Diaz, General Surgeon',
      applicant_relationship: 'Common-Law Partner',
      is_immediate_family: false,
      representative_name: `${beneficiary.first_name} ${beneficiary.last_name}`,
      representative_contact: beneficiary.contact_number || '09171234567',
      has_district_referral: false,
      hospital_confinement_status: 'discharged_with_balance',
      had_surgical_operation: true,
      total_amount_requested: 68000.00,
      status: 'For Additional Requirements',
      additional_requirements_notes: 'Please submit the Barangay Certification confirming common-law partnership or representation authority, as well as the signed Promissory Note from Medical City billing.',
      reviewed_by: adminUser?.id || null,
      reviewed_at: new Date(),
    });

    await MedicalAssistanceDocument.bulkCreate([
      {
        application_id: app4.id,
        document_code: 'rep_valid_id',
        document_name: "Representative's Valid ID (Back-to-Back)",
        file_path: 'uploads/documents/medical/sample-rep-id.pdf',
        file_name: 'common-law-rep-id.pdf',
        file_size: 151000,
        mime_type: 'application/pdf',
        status: 'Approved',
      },
      {
        application_id: app4.id,
        document_code: 'rep_patient_id',
        document_name: "Patient's or Partner's ID with Three (3) Signatures",
        file_path: 'uploads/documents/medical/sample-rep-patient-id.pdf',
        file_name: 'patient-id-with-3-signatures.pdf',
        file_size: 165000,
        mime_type: 'application/pdf',
        status: 'Approved',
      },
      {
        application_id: app4.id,
        document_code: 'rep_auth_letter',
        document_name: 'Authorization Letter from Patient or Partner',
        file_path: 'uploads/documents/medical/sample-auth-letter.pdf',
        file_name: 'signed-authorization-letter.pdf',
        file_size: 135000,
        mime_type: 'application/pdf',
        status: 'Approved',
      },
      {
        application_id: app4.id,
        document_code: 'medical_certificate',
        document_name: 'Original Medical Certificate',
        file_path: 'uploads/documents/medical/sample-med-cert.pdf',
        file_name: 'surgical-med-cert.pdf',
        file_size: 190000,
        mime_type: 'application/pdf',
        status: 'Approved',
      },
      {
        application_id: app4.id,
        document_code: 'clinical_abstract',
        document_name: 'Original Clinical Abstract',
        file_path: 'uploads/documents/medical/sample-clinical-abstract.pdf',
        file_name: 'clinical-abstract-appendectomy.pdf',
        file_size: 210000,
        mime_type: 'application/pdf',
        status: 'Approved',
      },
      {
        application_id: app4.id,
        document_code: 'final_hospital_bill',
        document_name: 'Final Hospital Bill (With Deductions)',
        file_path: 'uploads/documents/medical/sample-final-hospital-bill.pdf',
        file_name: 'final-bill-medical-city.pdf',
        file_size: 245000,
        mime_type: 'application/pdf',
        status: 'Approved',
      },
      {
        application_id: app4.id,
        document_code: 'certificate_of_balance',
        document_name: 'Certificate of Balance',
        file_path: 'uploads/documents/medical/sample-cert-balance.pdf',
        file_name: 'cert-balance-hospital.pdf',
        file_size: 140000,
        mime_type: 'application/pdf',
        status: 'Approved',
      },
      // Note: rep_brgy_cert and promissory_note are intentionally omitted to demonstrate 'For Additional Requirements' state!
    ]);

    console.log('✅ Successfully seeded 4 sample Medical Assistance applications!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding medical assistance:', error);
    process.exit(1);
  }
};

seedMedicalAssistance();
