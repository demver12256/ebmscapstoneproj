// ══════════════════════════════════════════════════════════════════════════
//  NON-CASH / IN-KIND PROGRAMS REGISTRY (DSWD & MSWDO STANDARDS)
//  Backend utility for identifying non-cash programs, assigning default items,
//  and validating distributions.
// ══════════════════════════════════════════════════════════════════════════

const NON_CASH_PROGRAMS = [
  // ─── PWD Programs (Persons with Disabilities) ───────────────────────────
  {
    name: 'PWD Inclusive Employment Facilitation',
    keywords: [
      'pwd inclusive employment',
      'employment facilitation',
      'inclusive employment',
      'job matching',
      'lgu employment facilitation',
      'job placement',
      'inclusive lgu employment'
    ],
    target: 'Persons with Disabilities (PWD)',
    assistance_type: 'Job matching, workplace accommodation advocacy, at direct employment facilitation (Walang perang cash na ipinamimigay)',
    default_item: 'Employment Facilitation & Job Matching Referral',
    badge: '💼 Trabaho & Job Facilitation',
    type: 'Service',
  },
  {
    name: 'PWD ID Registration and Benefit Card Issuance',
    keywords: [
      'pwd id',
      'benefit card',
      'purchase booklet',
      'id registration',
      'id issuance',
      'id renewal',
      'pdao / pwd id',
      'purchase booklet issuance'
    ],
    target: 'Persons with Disabilities (PWD)',
    assistance_type: 'Libreng PWD ID card issuance, digitized benefit card, at grocery/medicine purchase booklets (20% discount & VAT exemption)',
    default_item: 'Official PWD ID Card & Purchase Booklet',
    badge: '🪪 ID at Discount Booklet',
    type: 'Service',
  },
  {
    name: 'Assistive Devices / Disability Support',
    keywords: [
      'assistive devices',
      'assistive mobility devices',
      'disability support',
      'wheelchair',
      'wheelchairs',
      'crutches',
      'canes',
      'white cane',
      'white canes',
      'walking canes',
      'hearing aid',
      'hearing aids',
      'walker',
      'pdao free assistive devices',
      'osca free assistive'
    ],
    target: 'Persons with Disabilities (PWD) / Senior Citizens',
    assistance_type: 'Wheelchair, crutches, walking canes, white canes, at hearing assistive devices (Libreng kagamitan, walang cash)',
    default_item: 'Assistive Mobility Device (Wheelchair / Crutches / Canes)',
    badge: '♿ Assistive Mobility Device',
    type: 'In-Kind',
  },
  {
    name: 'PWD Skills & Vocational Tech-Voc Training',
    keywords: [
      'skills training',
      'vocational training',
      'tech-voc',
      'vocational tech-voc',
      'skills & vocational',
      'inclusive skills & vocational',
      'inclusive skills'
    ],
    target: 'Persons with Disabilities (PWD)',
    assistance_type: 'Libreng vocational skills training, livelihood workshops, at TESDA accreditation facilitation',
    default_item: 'Vocational Skills Training Module & Starter Kit',
    badge: '🎓 Libreng Skills Training',
    type: 'Service',
  },
  {
    name: 'Disaster Priority Relief & Evacuation for PWD Households',
    keywords: [
      'priority evacuation',
      'disaster preparedness',
      'pwd evacuation',
      'evacuation relief',
      'priority relief & evacuation',
      'disaster priority relief'
    ],
    target: 'Persons with Disabilities (PWD)',
    assistance_type: 'Specialized emergency relief food packs, hygiene kits, at priority disaster evacuation assistance',
    default_item: 'PWD Emergency Food & Hygiene Relief Pack',
    badge: '📦 Priority Relief Goods & Evacuation',
    type: 'In-Kind',
  },
  {
    name: 'PWD Medical & Physical Therapy Referral Assistance',
    keywords: [
      'physical therapy referral',
      'therapy referral',
      'rehabilitation services',
      'physical therapy'
    ],
    target: 'Persons with Disabilities (PWD)',
    assistance_type: 'Libreng referral para sa physical therapy, rehabilitation sessions, at medical consultations',
    default_item: 'Physical Therapy Endorsement & Treatment Session',
    badge: '🏥 Therapy & Health Referral',
    type: 'Service',
  },

  // ─── Senior Citizen Programs ────────────────────────────────────────────
  {
    name: 'MSWDO Senior Maintenance Medicine & Health Subsidy',
    keywords: [
      'maintenance medicine',
      'medicine subsidy',
      'geriatric vaccination'
    ],
    target: 'Senior Citizens',
    assistance_type: 'Libreng maintenance medicines (hypertension, diabetes), bitamina, at geriatric vaccines',
    default_item: 'Monthly Maintenance Medicine Package',
    badge: '💊 Libreng Gamot & Medisina',
    type: 'In-Kind',
  },
  {
    name: 'Elderly Filipino Week & Senior Wellness Celebration',
    keywords: [
      'elderly filipino week',
      'senior wellness celebration',
      'wellness celebration'
    ],
    target: 'Senior Citizens',
    assistance_type: 'Health screening, geriatric wellness activities, socialization, at wellness gift packs',
    default_item: 'Senior Wellness Kit & Celebration Pack',
    badge: '🎉 Wellness & Celebration',
    type: 'Service',
  },
  {
    name: 'Bedridden Senior Home Care & Mobile Payout Service',
    keywords: [
      'bedridden senior',
      'home care & mobile payout',
      'bedridden'
    ],
    target: 'Bedridden Senior Citizens',
    assistance_type: 'House-to-house mobile care visit, medical wellness check, at home-based service',
    default_item: 'Home Care Nursing & Comfort Kit',
    badge: '🩺 Bedridden Home Care',
    type: 'Service',
  },
  {
    name: 'Senior Citizens Health & Geriatric Wellness Program',
    keywords: [
      'geriatric wellness',
      'osca assistance',
      'osca referral',
      'health and wellness programs'
    ],
    target: 'Senior Citizens',
    assistance_type: 'Geriatric consultations, OSCA privileges assistance, at institutional referral',
    default_item: 'OSCA Health & Wellness Consultation',
    badge: '🩺 OSCA Health & Wellness',
    type: 'Service',
  },
  {
    name: 'Emergency Food & Calamity Relief for Seniors',
    keywords: [
      'emergency food & calamity relief',
      'calamity relief for seniors'
    ],
    target: 'Senior Citizens',
    assistance_type: 'Emergency family food packs at grocery items para sa mga senior citizens',
    default_item: 'Senior Emergency Food Pack',
    badge: '📦 Senior Relief Goods',
    type: 'In-Kind',
  },

  // ─── 4Ps & General Welfare Programs ─────────────────────────────────────
  {
    name: 'Supplementary Feeding Program (SFP)',
    keywords: ['supplementary feeding', 'feeding program', 'sfp'],
    target: 'Mga batang kabilang sa mahihirap na pamilya, kabilang ang maaaring anak ng 4Ps',
    assistance_type: 'Libreng pagkain at mainit na masustansyang nutrisyon',
    default_item: 'Hot Meals / Nutritious Food Ration',
    badge: '🍱 Libreng Pagkain',
    type: 'In-Kind',
  },
  {
    name: 'Family Development Session (FDS)',
    keywords: ['family development session', 'fds'],
    target: '4Ps Beneficiaries',
    assistance_type: 'Seminar at training tungkol sa parenting, health, education, at livelihood',
    default_item: 'FDS Modular Workshop Attendance & Kit',
    badge: '🎓 Seminar & Training',
    type: 'Service',
  },
  {
    name: 'Sustainable Livelihood Program (SLP)',
    keywords: ['sustainable livelihood', 'slp'],
    target: 'Maaaring 4Ps, PWD, Senior o iba pang qualified individuals',
    assistance_type: 'Skills training at livelihood development starter kit',
    default_item: 'Livelihood Development & Starter Toolkit',
    badge: '🛠️ Livelihood & Skills',
    type: 'Service',
  },
  {
    name: 'Disaster Relief Assistance',
    keywords: ['disaster relief', 'relief goods', 'food packs', 'calamity relief', 'emergency relief'],
    target: '4Ps, Senior, PWD at disaster victims',
    assistance_type: 'Food packs, hygiene kits, sleeping kits, at iba pang relief goods',
    default_item: 'Family Food Pack & Hygiene Relief Kit',
    badge: '📦 Relief Goods & Packs',
    type: 'In-Kind',
  },
  {
    name: 'Referral Services',
    keywords: ['referral services', 'referral service', 'referral'],
    target: '4Ps, Senior, PWD',
    assistance_type: 'Referral sa ospital, TESDA, DOLE, PhilHealth, at iba pang ahensya',
    default_item: 'Institutional Referral Slip & Endorsement',
    badge: '📋 Referral Service',
    type: 'Service',
  },
  {
    name: 'Counseling / Case Management',
    keywords: ['counseling', 'case management', 'social work'],
    target: 'Lahat ng qualified beneficiaries',
    assistance_type: 'Social work assistance at counseling',
    default_item: 'Social Work Counseling & Intervention',
    badge: '🤝 Social Work / Counseling',
    type: 'Service',
  },
  {
    name: 'Community Programs',
    keywords: ['community programs', 'community program', 'community development'],
    target: '4Ps, Senior, PWD',
    assistance_type: 'Seminars, activities, at community development',
    default_item: 'Community Participation & Development Activity',
    badge: '👥 Community Activity',
    type: 'Service',
  },
];

function isNonCashProgram(programName, benefitType) {
  if (benefitType && benefitType.toLowerCase() !== 'cash') {
    return true;
  }
  if (!programName) return false;
  const lower = String(programName).toLowerCase();
  return NON_CASH_PROGRAMS.some(
    (p) => lower.includes(p.name.toLowerCase()) || p.keywords.some((kw) => lower.includes(kw))
  );
}

function getNonCashDetails(programName) {
  if (!programName) return null;
  const lower = String(programName).toLowerCase();
  const found = NON_CASH_PROGRAMS.find(
    (p) => lower.includes(p.name.toLowerCase()) || p.keywords.some((kw) => lower.includes(kw))
  );
  if (found) return found;

  return {
    name: programName,
    target: 'Qualified Beneficiaries',
    assistance_type: 'Non-Cash Assistance / In-Kind Goods (Walang perang ipapamahagi)',
    default_item: 'In-Kind Goods / Service Package',
    badge: '📦 Non-Cash / In-Kind',
    type: 'In-Kind',
  };
}

module.exports = {
  NON_CASH_PROGRAMS,
  isNonCashProgram,
  getNonCashDetails,
};
