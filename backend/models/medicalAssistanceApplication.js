module.exports = (sequelize, DataTypes) => {
  const MedicalAssistanceApplication = sequelize.define(
    'MedicalAssistanceApplication',
    {
      application_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      beneficiary_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      barangay_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      agency: {
        type: DataTypes.ENUM('DSWD', 'MSWDO'),
        allowNull: false,
        defaultValue: 'DSWD',
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // Patient Information
      patient_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      patient_gender: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      patient_dob: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      patient_contact: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      patient_address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      hospital_or_clinic_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      diagnosis: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      attending_physician: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // Representative / Applicant Relationship Information
      applicant_relationship: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Self',
        comment: 'Mother, Father, Son, Daughter, Sibling, Common-Law Partner, Authorized Representative, etc.',
      },
      is_immediate_family: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      representative_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      representative_contact: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // Category Specific Situational Flags
      // Referral letter requirement
      has_district_referral: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // Medicines
      pharmacy_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'e.g. Oriental 21 Pharmacy, Generika Drugstore, or accredited pharmacy',
      },
      // Laboratory
      lab_procedure_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lab_requires_payment: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lab_guarantee_letter_facility: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // Hospital Bill
      hospital_confinement_status: {
        type: DataTypes.ENUM(
          'currently_confined',
          'discharged_with_balance',
          'discharged_outstanding',
          'not_applicable'
        ),
        allowNull: false,
        defaultValue: 'not_applicable',
      },
      had_surgical_operation: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'If operation/surgical procedure was performed, Clinical Abstract is required',
      },
      // Amounts and Grants
      total_amount_requested: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0,
      },
      approved_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0,
      },
      assistance_type_granted: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Guarantee Letter, Direct Financial Aid, Pharmacy Voucher, etc.',
      },
      // Application Status Lifecycle
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Draft',
      },
      rejection_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      additional_requirements_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      staff_remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      barangay_verified_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      barangay_verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      barangay_endorsement_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reviewed_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      released_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      released_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'medical_assistance_applications',
      underscored: true,
    }
  );

  return MedicalAssistanceApplication;
};
