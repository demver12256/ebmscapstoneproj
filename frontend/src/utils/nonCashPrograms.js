// ══════════════════════════════════════════════════════════════════════════
//  NON-CASH / IN-KIND PROGRAMS REGISTRY (DSWD & MSWDO STANDARDS)
//  These programs do not disburse cash amounts; instead they provide in-kind
//  goods, food packs, assistive devices, seminars, training, or social services.
// ══════════════════════════════════════════════════════════════════════════

export const NON_CASH_PROGRAMS = [
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
    badge_color: 'bg-teal-100 text-teal-800 border-teal-300',
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
    badge_color: 'bg-blue-100 text-blue-800 border-blue-300',
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
    badge_color: 'bg-purple-100 text-purple-800 border-purple-300',
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
    badge_color: 'bg-teal-100 text-teal-800 border-teal-300',
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
    badge_color: 'bg-amber-100 text-amber-800 border-amber-300',
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
    badge_color: 'bg-rose-100 text-rose-800 border-rose-300',
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
    badge_color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
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
    badge_color: 'bg-violet-100 text-violet-800 border-violet-300',
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
    badge_color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
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
    badge_color: 'bg-cyan-100 text-cyan-800 border-cyan-300',
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
    badge_color: 'bg-blue-100 text-blue-800 border-blue-300',
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
    badge_color: 'bg-amber-100 text-amber-800 border-amber-300',
    type: 'In-Kind',
  },
  {
    name: 'Family Development Session (FDS)',
    keywords: ['family development session', 'fds'],
    target: '4Ps Beneficiaries',
    assistance_type: 'Seminar at training tungkol sa parenting, health, education, at livelihood',
    default_item: 'FDS Modular Workshop Attendance & Kit',
    badge: '🎓 Seminar & Training',
    badge_color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    type: 'Service',
  },
  {
    name: 'Sustainable Livelihood Program (SLP)',
    keywords: ['sustainable livelihood', 'slp'],
    target: 'Maaaring 4Ps, PWD, Senior o iba pang qualified individuals',
    assistance_type: 'Skills training at livelihood development starter kit',
    default_item: 'Livelihood Development & Starter Toolkit',
    badge: '🛠️ Livelihood & Skills',
    badge_color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    type: 'Service',
  },
  {
    name: 'Disaster Relief Assistance',
    keywords: ['disaster relief', 'relief goods', 'food packs', 'calamity relief', 'emergency relief'],
    target: '4Ps, Senior, PWD at disaster victims',
    assistance_type: 'Food packs, hygiene kits, sleeping kits, at iba pang relief goods',
    default_item: 'Family Food Pack & Hygiene Relief Kit',
    badge: '📦 Relief Goods & Packs',
    badge_color: 'bg-blue-100 text-blue-800 border-blue-300',
    type: 'In-Kind',
  },
  {
    name: 'Referral Services',
    keywords: ['referral services', 'referral service', 'referral'],
    target: '4Ps, Senior, PWD',
    assistance_type: 'Referral sa ospital, TESDA, DOLE, PhilHealth, at iba pang ahensya',
    default_item: 'Institutional Referral Slip & Endorsement',
    badge: '📋 Referral Service',
    badge_color: 'bg-sky-100 text-sky-800 border-sky-300',
    type: 'Service',
  },
  {
    name: 'Counseling / Case Management',
    keywords: ['counseling', 'case management', 'social work'],
    target: 'Lahat ng qualified beneficiaries',
    assistance_type: 'Social work assistance at counseling',
    default_item: 'Social Work Counseling & Intervention',
    badge: '🤝 Social Work / Counseling',
    badge_color: 'bg-rose-100 text-rose-800 border-rose-300',
    type: 'Service',
  },
  {
    name: 'Community Programs',
    keywords: ['community programs', 'community program', 'community development'],
    target: '4Ps, Senior, PWD',
    assistance_type: 'Seminars, activities, at community development',
    default_item: 'Community Participation & Development Activity',
    badge: '👥 Community Activity',
    badge_color: 'bg-violet-100 text-violet-800 border-violet-300',
    type: 'Service',
  },
];

/**
 * Checks if a given program name or benefit type represents a non-cash program.
 * @param {string} programName
 * @param {string} [benefitType]
 * @returns {boolean}
 */
export function isNonCashProgram(programName, benefitType) {
  if (benefitType && benefitType.toLowerCase() !== 'cash') {
    return true;
  }
  if (!programName) return false;
  const lower = String(programName).toLowerCase();
  return NON_CASH_PROGRAMS.some(
    (p) => lower.includes(p.name.toLowerCase()) || p.keywords.some((kw) => lower.includes(kw))
  );
}

/**
 * Retrieves the full metadata and non-cash details for a program name.
 * @param {string} programName
 * @returns {object|null}
 */
export function getNonCashDetails(programName) {
  if (!programName) return null;
  const lower = String(programName).toLowerCase();
  const found = NON_CASH_PROGRAMS.find(
    (p) => lower.includes(p.name.toLowerCase()) || p.keywords.some((kw) => lower.includes(kw))
  );
  if (found) return found;

  // Fallback for general In-Kind / Non-Cash
  return {
    name: programName,
    target: 'Qualified Beneficiaries',
    assistance_type: 'Non-Cash Assistance / In-Kind Goods (Walang perang ipapamahagi)',
    default_item: 'In-Kind Goods / Service Package',
    badge: '📦 Non-Cash / In-Kind',
    badge_color: 'bg-slate-100 text-slate-800 border-slate-300',
    type: 'In-Kind',
  };
}

/**
 * Retrieves metadata for Cash Assistance programs to clearly show what financial
 * benefit is provided and how payout is disbursed.
 * @param {string} programName
 * @returns {object}
 */
export function getCashProgramDetails(programName) {
  if (!programName) return null;
  const lower = String(programName).toLowerCase();

  if (lower.includes('pension') || lower.includes('socpen')) {
    return {
      type: 'Cash Assistance',
      badge: '💵 Regular Cash Pension',
      assistance_type: 'Buwanang pensyon / monetary allowance (₱500 - ₱1,000/buwan) para sa mga kwalipikadong indigent seniors.',
      payout_method: 'Cash Over-The-Counter (OTC Payout) o Digital E-Wallet (GCash / Maya / Landbank Card).',
      requires_amount: true,
    };
  }
  if (lower.includes('centenarian') || lower.includes('longevity') || lower.includes('milestone')) {
    return {
      type: 'Cash Assistance',
      badge: '💵 Longevity Milestone Cash Gift',
      assistance_type: 'Isang beses na cash gift (₱5,000 - ₱100,000) bilang pagkilala sa milestone na edad ng senior citizen.',
      payout_method: 'Cash Over-The-Counter (OTC) o Direct Municipal / DSWD Cash Check Payout.',
      requires_amount: true,
    };
  }
  if (lower.includes('allowance') || lower.includes('financial allowance')) {
    return {
      type: 'Cash Assistance',
      badge: '💵 Financial Cash Allowance',
      assistance_type: 'Direktang monetary stipend / cash allowance upang pantustos sa araw-araw na pangangailangan.',
      payout_method: 'Cash Over-The-Counter (OTC Payout) o Digital E-Wallet (GCash / Maya / Landbank Card).',
      requires_amount: true,
    };
  }
  if (lower.includes('educational') || lower.includes('education grant') || lower.includes('sped')) {
    return {
      type: 'Cash Assistance',
      badge: '💵 Educational Cash Grant',
      assistance_type: 'Pinansyal na tulong pang-edukasyon (cash stipend) para sa matrikula, kagamitan sa eskwela, at allowances.',
      payout_method: 'Cash Over-The-Counter (OTC Payout) o Digital E-Wallet (GCash / Maya / Landbank Card).',
      requires_amount: true,
    };
  }
  if (lower.includes('burial') || lower.includes('funeral') || lower.includes('damayan')) {
    return {
      type: 'Cash Assistance',
      badge: '💵 Burial / Mortuary Cash Aid',
      assistance_type: 'Pinansyal na tulong sa pamilya para sa gastusin sa burol at libing (₱3,000 - ₱10,000+).',
      payout_method: 'Cash Over-The-Counter (OTC Payout) o Emergency Financial Assistance.',
      requires_amount: true,
    };
  }
  if (lower.includes('medical') || lower.includes('hospitalization') || lower.includes('diagnostic')) {
    return {
      type: 'Cash Assistance',
      badge: '💵 Medical & Hospital Cash Subsidy',
      assistance_type: 'Pinansyal na subsidiya para sa pambili ng gamot, laboratory tests, o ospital (Cash Aid / Guarantee Letter).',
      payout_method: 'Cash Over-The-Counter (OTC Payout) o Guarantee Letter (GL).',
      requires_amount: true,
    };
  }
  if (lower.includes('capital') || lower.includes('microenterprise') || lower.includes('micro-enterprise')) {
    return {
      type: 'Cash Assistance',
      badge: '💵 Livelihood Seed Capital Grant',
      assistance_type: 'Panimulang pondong salapi (seed capital ₱5,000 - ₱15,000) para sa pagsisimula ng maliit na negosyo.',
      payout_method: 'Cash Over-The-Counter (OTC Payout) o Digital E-Wallet.',
      requires_amount: true,
    };
  }
  if (lower.includes('birthday')) {
    return {
      type: 'Cash Assistance',
      badge: '🎂 Birthday Cash Gift & Pack',
      assistance_type: 'Taunang birthday cash incentive (₱500 - ₱2,000) kasama ang gift pack para sa kaarawan.',
      payout_method: 'Cash Over-The-Counter (OTC Payout) o Door-to-Door Service.',
      requires_amount: true,
    };
  }
  if (lower.includes('cash-for-work')) {
    return {
      type: 'Cash Assistance',
      badge: '💵 Cash-For-Work Allowance',
      assistance_type: 'Pang-araw-araw na sahod o kompensasyon sa panandaliang serbisyo sa komunidad.',
      payout_method: 'Cash Over-The-Counter (OTC Payout).',
      requires_amount: true,
    };
  }
  if (lower.includes('4ps') || lower.includes('health') || lower.includes('rice subsidy')) {
    return {
      type: 'Cash Assistance',
      badge: '💵 4Ps Cash Subsidy / Grant',
      assistance_type: 'Regular na conditional cash transfer / monetary subsidy para sa kalusugan, nutrisyon, o bigas.',
      payout_method: 'Digital Cash Card / Landbank o Cash Over-The-Counter (OTC Payout).',
      requires_amount: true,
    };
  }

  // Default general Cash Assistance
  return {
    type: 'Cash Assistance',
    badge: '💵 Cash Assistance / Ayuda',
    assistance_type: 'Pinansyal na tulong o cash grant na ipamamahagi sa kwalipikadong benepisyaryo.',
    payout_method: 'Cash Over-The-Counter (OTC Payout) o Digital E-Wallet (GCash / Maya / Landbank Card).',
    requires_amount: true,
  };
}

/**
 * Comprehensive classification of a program (Cash vs Non-Cash)
 * providing uniform metadata for UI banners, badges, and tooltips.
 * @param {string} programName
 * @param {string} [benefitType]
 * @returns {object|null}
 */
export function getProgramAssistanceClassification(programName, benefitType) {
  if (!programName) return null;
  const isNonCash = isNonCashProgram(programName, benefitType);
  if (isNonCash) {
    const details = getNonCashDetails(programName);
    return {
      isNonCash: true,
      classification: 'In-Kind / Non-Cash Program',
      badge: details.badge,
      badgeColor: details.badge_color || 'bg-purple-100 text-purple-800 border-purple-300',
      assistanceType: details.assistance_type,
      disbursementMethod: 'Pamamahagi ng gamit, serbisyo, o referral sa itinakdang distribution venue/tanggapan (Walang cash payout).',
      target: details.target,
      itemDefault: details.default_item,
    };
  } else {
    const details = getCashProgramDetails(programName);
    return {
      isNonCash: false,
      classification: 'Cash Assistance Program',
      badge: details.badge,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      assistanceType: details.assistance_type,
      disbursementMethod: details.payout_method,
      target: 'Kwalipikadong Benepisyaryo (Nangangailangan ng Budget Allocation & Payout)',
      itemDefault: null,
    };
  }
}
