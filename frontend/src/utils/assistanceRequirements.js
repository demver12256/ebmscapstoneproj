/**
 * Unified Requirements Configuration for DSWD & MSWDO Assistance Services
 * Provides bilingual (Filipino & English) metadata, mandatory flags, and guidance.
 */

export const ASSISTANCE_REQUIREMENTS = {
  'Medical Assistance': {
    title: 'Medical & Medicines Assistance',
    filipinoTitle: 'Tulong sa Gamot at Maintenance',
    description: 'Mga kinakailangang dokumento para sa pagbili ng mga iniresetang gamot at maintenance drugs.',
    requirements: [
      {
        id: 'prescription',
        name: "Doctor's Prescription (Reseta ng Doktor)",
        filipinoName: 'Reseta ng Doktor (May License & PTR)',
        description: 'Updated na reseta na hindi lalampas sa 3 buwan, may generic name, tamang dosage, at pirma ng doktor.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'medical_certificate',
        name: 'Medical Certificate / Clinical Summary',
        filipinoName: 'Medical Certificate mula sa Doktor',
        description: 'Opisyal na katibayan ng sakit o diagnosis na pirmado ng lisensyadong manggagamot.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'price_quotation',
        name: 'Official Pharmacy Price Quotation',
        filipinoName: 'Price Quotation mula sa Lisensyadong Botika',
        description: 'Opisyal na quotation mula sa botika (hal. Oriental 21, Generika, Mercury Drug) na may kabuuang presyo.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'valid_id',
        name: 'Valid Government ID (Front & Back)',
        filipinoName: 'Valid ID ng Pasyente o Claimant (Harap at Likod)',
        description: 'National ID, Senior Citizen ID, PWD ID, 4Ps ID, o iba pang opisyal na ID.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'brgy_indigency',
        name: 'Barangay Certificate of Indigency',
        filipinoName: 'Barangay Certificate of Indigency',
        description: 'Patunay ng paninirahan at mababang kita mula sa kinasasakupang barangay.',
        mandatory: false,
        tag: 'Suporta (Supporting)',
      },
    ],
  },

  'Hospital Assistance': {
    title: 'Hospital & Confinement Assistance',
    filipinoTitle: 'Tulong sa Ospital at Confinement',
    description: 'Mga dokumento para sa bayarin sa pagkakaospital, in-patient care, at operasyon.',
    requirements: [
      {
        id: 'clinical_abstract',
        name: 'Medical Certificate / Clinical Abstract',
        filipinoName: 'Medical Certificate o Clinical Abstract',
        description: 'Paliwanag ng attending physician tungkol sa medikal na kalagayan at naging gamutan.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'hospital_bill',
        name: 'Hospital Statement of Account / Billing',
        filipinoName: 'Hospital Statement of Account / Billing',
        description: 'Marked "UP TO PRESENT" kung kasalukuyang confined, o Final Hospital Bill (na bawas na ang PhilHealth/HMO) kung na-discharge na.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'promissory_note',
        name: 'Promissory Note & Certificate of Balance',
        filipinoName: 'Promissory Note at Certificate of Balance (Kung Discharged)',
        description: 'Kailangan kung pinayagang makalabas ang pasyente na may natitirang balanse sa ospital.',
        mandatory: false,
        tag: 'Suporta (Supporting)',
      },
      {
        id: 'valid_id',
        name: 'Valid Government ID of Patient or Representative',
        filipinoName: 'Valid ID ng Pasyente o Kinatawan (Harap at Likod)',
        description: 'Photocopy ng valid ID ng pasyente o ng naglalakad na kamag-anak.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'brgy_indigency',
        name: 'Barangay Certificate of Indigency',
        filipinoName: 'Barangay Certificate of Indigency',
        description: 'Patunay ng kapos-palad na kalagayan para sa tulong-pinansyal.',
        mandatory: false,
        tag: 'Suporta (Supporting)',
      },
    ],
  },

  'Laboratory Assistance': {
    title: 'Laboratory & Diagnostic Assistance',
    filipinoTitle: 'Tulong sa Laboratory at Pagsusuri',
    description: 'Mga kinakailangan para sa diagnostic tests tulad ng X-Ray, CT Scan, Ultrasound, at Blood Chem.',
    requirements: [
      {
        id: 'lab_request',
        name: "Doctor's Laboratory Request / Diagnostic Order",
        filipinoName: 'Laboratory Request Slip mula sa Doktor',
        description: 'Opisyal na request ng manggagamot na nagsasaad ng partikular na pagsusuri na kailangan.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'lab_quotation',
        name: 'Official Price Quotation from Diagnostic Lab',
        filipinoName: 'Price Quotation mula sa Laboratoryo o Clinic',
        description: 'Opisyal na breakdown ng singil mula sa laboratoryo o diagnostic center.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'valid_id',
        name: 'Valid Government ID (Front & Back)',
        filipinoName: 'Valid ID ng Pasyente o Kinatawan',
        description: 'Photocopy ng government ID ng pasyente o ng kinatawan.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'brgy_indigency',
        name: 'Barangay Certificate of Indigency',
        filipinoName: 'Barangay Certificate of Indigency',
        description: 'Patunay ng kakapusan sa pananalapi para sa subsidiya sa laboratoryo.',
        mandatory: false,
        tag: 'Suporta (Supporting)',
      },
    ],
  },

  'Educational Assistance': {
    title: 'Educational Assistance',
    filipinoTitle: 'Tulong Pang-edukasyon',
    description: 'Mga dokumentong kailangan para sa matrikula, enrollment fees, at gamit pang-eskwela.',
    requirements: [
      {
        id: 'coe_cor',
        name: 'Certificate of Enrollment / Registration (COE / COR)',
        filipinoName: 'Certificate of Enrollment / Registration Form (COE/COR)',
        description: 'Opisyal at validated enrollment form para sa kasalukuyang semestre o school year.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'school_id',
        name: 'Valid School ID of Student (Front & Back)',
        filipinoName: 'Valid School ID ng Estudyante (Harap at Likod)',
        description: 'Malinaw na kopya ng school ID ng mag-aaral para sa kasalukuyang taon.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'assessment_fees',
        name: 'Statement of Account / Assessment of Fees',
        filipinoName: 'Statement of Account o Assessment of School Fees',
        description: 'Opisyal na billing mula sa Registrar o Accounting Office ng paaralan.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'brgy_indigency',
        name: 'Barangay Certificate of Indigency',
        filipinoName: 'Barangay Certificate of Indigency',
        description: 'Patunay na ang mag-aaral o pamilya ay kabilang sa indigent / low-income household.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'parent_id',
        name: 'Valid ID of Parent / Guardian',
        filipinoName: 'Valid ID ng Magulang o Guardian',
        description: 'Photocopy ng ID ng magulang o tagapangalaga ng estudyante.',
        mandatory: false,
        tag: 'Suporta (Supporting)',
      },
    ],
  },

  'Financial Assistance': {
    title: 'Financial Assistance (AICS / Crisis Grant)',
    filipinoTitle: 'Pangkagipitang Ayuda (AICS Cash Aid)',
    description: 'Mga kinakailangan para sa pamilya o indibidwal na nasa biglaang krisis o sakuna.',
    requirements: [
      {
        id: 'brgy_indigency',
        name: 'Barangay Certificate of Indigency',
        filipinoName: 'Barangay Certificate of Indigency',
        description: 'Katibayan ng krisis at low-income status mula sa barangay.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'justification_letter',
        name: 'Letter of Intent / Justification (Salaysay ng Krisis)',
        filipinoName: 'Sulat-Salaysay / Letter of Intent ng Pangangailangan',
        description: 'Maikling salaysay ng emergency crisis at kung bakit kailangan ang pangkagipitang ayuda.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'incident_report',
        name: 'Incident Report / Blotter / Disaster Certificate',
        filipinoName: 'Incident Report mula sa BFP, PNP, o MDRRMO (Kung may Sakuna)',
        description: 'Patunay kung ang krisis ay dulot ng sunog, aksidente, o kalamidad.',
        mandatory: false,
        tag: 'Suporta (Supporting)',
      },
      {
        id: 'valid_id',
        name: 'Valid Government ID of Applicant (Front & Back)',
        filipinoName: 'Valid ID ng Aplikante / Claimant (Harap at Likod)',
        description: 'Government ID ng humihiling ng pangkagipitang tulong.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
    ],
  },

  'Burial Assistance': {
    title: 'Burial & Funeral Assistance',
    filipinoTitle: 'Tulong sa Pagpapalibing',
    description: 'Mga dokumento para sa tulong sa serbisyo ng punerarya, kabaong, at gastusin sa libing.',
    requirements: [
      {
        id: 'death_certificate',
        name: 'Registered Certificate of Death',
        filipinoName: 'Registered Death Certificate (PSA o Local Civil Registrar)',
        description: 'Certified True Copy o PSA copy ng Death Certificate ng yumao na may registry number.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'funeral_contract',
        name: 'Funeral Contract / Statement of Account',
        filipinoName: 'Funeral Contract o Statement of Account mula sa Punerarya',
        description: 'Opisyal na kontrata na nagpapakita ng kabuuang halaga at natitirang balanse sa punerarya.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'relationship_proof',
        name: 'Proof of Relationship to Deceased',
        filipinoName: 'Patunay ng Relasyon sa Yumao (Birth/Marriage Certificate)',
        description: 'Marriage Certificate kung asawa, o Birth Certificate kung anak o magulang ng yumao.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'brgy_indigency',
        name: 'Barangay Certificate of Indigency of Claimant',
        filipinoName: 'Barangay Certificate of Indigency ng Nag-aasikaso',
        description: 'Patunay ng kakapusan sa pananalapi ng nag-aasikaso ng libing.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'claimant_id',
        name: 'Valid Government ID of Claimant',
        filipinoName: 'Valid ID ng Nagke-claim (Harap at Likod)',
        description: 'Photocopy ng valid ID ng claimant o pamilya ng pumanaw.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
    ],
  },

  'Food & Relief Assistance': {
    title: 'Food & Relief Assistance',
    filipinoTitle: 'Ayuda sa Pagkain at Relief Goods',
    description: 'Mga kinakailangang dokumento para sa emergency food packages at tulong relief goods.',
    requirements: [
      {
        id: 'valid_id',
        name: 'Valid Beneficiary ID (4Ps, Senior, PWD, or Brgy ID)',
        filipinoName: 'Valid ID / Beneficiary ID (4Ps, Senior, PWD, o Barangay ID)',
        description: 'Patunay ng pagiging rehistradong benepisyaryo o residente.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
      {
        id: 'brgy_certification',
        name: 'Barangay Indigency or Disaster Relief Certification',
        filipinoName: 'Barangay Indigency o Katibayan ng Pangangailangan',
        description: 'Katibayan mula sa barangay na apektado ng kalamidad, krisis, o nangangailangan ng food packs.',
        mandatory: true,
        tag: 'Kailangan (Required)',
      },
    ],
  },
};

/**
 * Helper to get requirements for an assistance type (with safe fallback)
 */
export const getRequirementsForType = (assistanceType) => {
  if (!assistanceType) return null;
  // Direct match
  if (ASSISTANCE_REQUIREMENTS[assistanceType]) {
    return ASSISTANCE_REQUIREMENTS[assistanceType];
  }
  // Partial match fallback
  const key = Object.keys(ASSISTANCE_REQUIREMENTS).find((k) =>
    assistanceType.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(assistanceType.toLowerCase())
  );
  return key ? ASSISTANCE_REQUIREMENTS[key] : null;
};

/**
 * Safely parse attachment_url which can be:
 * - A single URL string: "/uploads/documents/assistance/assist-123.pdf"
 * - A JSON string array: '[{"name":"...","url":"..."}]'
 * - An array already
 */
export const parseAttachments = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object') return [parsed];
      } catch (e) {
        // Not valid JSON, fallback to single URL
      }
    }
    return [
      {
        name: trimmed.split('/').pop() || 'Supporting Document',
        url: trimmed,
      },
    ];
  }
  return [];
};
