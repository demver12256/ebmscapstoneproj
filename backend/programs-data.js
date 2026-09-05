// Comprehensive Programs Data for EBMS (Updated 2026 DSWD Standards)

const programsData = [
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4Ps Household Beneficiaries Programs (RA 11310)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    category: '4Ps Household Beneficiaries',
    name: '4Ps Health & Nutrition Cash Grant',
    description: 'Monthly health subsidy (₱750/month) for qualified 4Ps households compliant with regular health center check-ups and child immunization.',
    type: 'Cash Assistance',
  },
  {
    category: '4Ps Household Beneficiaries',
    name: '4Ps First 1,000 Days (F1KD) Nutrition Subsidy',
    description: 'Conditional cash grant for pregnant women, nursing mothers, and children aged 0-24 months to address malnutrition and stunting.',
    type: 'Nutrition Support',
  },
  {
    category: '4Ps Household Beneficiaries',
    name: '4Ps Education Grant - Elementary',
    description: 'Educational cash assistance (₱300/month per child) for elementary school students of 4Ps households (up to 10 months/year).',
    type: 'Education',
  },
  {
    category: '4Ps Household Beneficiaries',
    name: '4Ps Education Grant - Junior High School',
    description: 'Educational cash assistance (₱500/month per child) for junior high school students of 4Ps households (up to 10 months/year).',
    type: 'Education',
  },
  {
    category: '4Ps Household Beneficiaries',
    name: '4Ps Education Grant - Senior High School',
    description: 'Educational cash assistance (₱700/month per child) for senior high school students of 4Ps households (up to 10 months/year).',
    type: 'Education',
  },
  {
    category: '4Ps Household Beneficiaries',
    name: '4Ps Rice Subsidy Allowance',
    description: 'Monthly rice assistance cash subsidy (₱600/month per household) to augment staple food and grain security.',
    type: 'Food Assistance',
  },
  {
    category: '4Ps Household Beneficiaries',
    name: '4Ps Family Development Sessions (FDS)',
    description: 'Mandatory monthly modular workshops on responsible parenting, home management, health, financial literacy, and disaster resilience.',
    type: 'Training/Education',
  },
  {
    category: '4Ps Household Beneficiaries',
    name: 'Sustainable Livelihood Program (SLP) Referral & Seed Capital',
    description: 'Micro-enterprise development or employment facilitation capital grant for graduating 4Ps households under Kilos Unlad.',
    type: 'Livelihood',
  },
  {
    category: '4Ps Household Beneficiaries',
    name: 'Cash-for-Work / Climate & Disaster Resiliency',
    description: 'Temporary community employment and financial assistance for disaster risk reduction and community rehabilitation.',
    type: 'Employment',
  },
  {
    category: '4Ps Household Beneficiaries',
    name: 'Assistance to Individuals in Crisis Situation (AICS) - Emergency Relief',
    description: 'Immediate emergency financial assistance for medical, burial, and transportation crises.',
    type: 'Emergency Relief',
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Senior Citizens (Social Pension) Programs (RA 11916 & RA 11982)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'MSWDO Local Social Pension (Municipal Counterpart)',
    description: 'Monthly municipal social pension (₱500–₱1,000/month) for indigent senior citizens waitlisted or uncovered by national SocPen.',
    type: 'Cash Assistance',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'Senior Citizens Birthday Cash Incentive & Gift Pack',
    description: 'Annual birthday cash gift (₱500–₱2,000) and nutritious grocery package for registered senior citizens under municipal ordinance.',
    type: 'Cash Assistance',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'Senior Citizens Longevity Milestone Award (70, 75, 80+)',
    description: 'Municipal longevity cash incentive (₱5,000–₱10,000) honoring senior citizens reaching milestone ages prior to centenarian status.',
    type: 'Cash Assistance',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'OSCA Free Assistive Mobility Devices (Wheelchairs & Canes)',
    description: 'Free distribution of standard wheelchairs, walkers, quad canes, and hearing aids for frail, mobility-impaired, or bedridden seniors.',
    type: 'Medical Support',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'MSWDO Senior Maintenance Medicine & Health Subsidy',
    description: 'Free maintenance medicines (hypertension, diabetes), vitamins, and geriatric vaccinations in partnership with the Rural Health Unit (RHU).',
    type: 'Health',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'Local Senior Burial & Funeral Assistance (Damayan)',
    description: 'Municipal burial and mortuary cash aid (₱3,000–₱10,000) to support bereaved indigent senior citizen families.',
    type: 'Financial Assistance',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'Bedridden Senior Home Care & Mobile Payout Service',
    description: 'House-to-house delivery of pensions, medical wellness monitoring, and basic care packages for immobile or bedridden seniors.',
    type: 'Support Services',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'Elderly Filipino Week & Senior Wellness Celebration',
    description: 'Annual municipal celebration featuring health screenings, socialization, sports and arts festivals, and wellness gift packs.',
    type: 'Health',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'Social Pension for Indigent Senior Citizens (SocPen)',
    description: 'Monthly social pension (₱1,000/month; ₱6,000 semestrally under RA 11916) for indigent seniors aged 60 and above without permanent income or other pensions.',
    type: 'Cash Assistance',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'Expanded Centenarian Milestone Cash Gift (Ages 80, 85, 90, 95)',
    description: 'Cash grant of ₱10,000 for elderly Filipinos reaching age milestones of 80, 85, 90, and 95 (under RA 11982) with official letter of felicitation.',
    type: 'Cash Assistance',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'Centenarian Cash Gift (100 Years Old)',
    description: 'National cash gift of ₱100,000 and Presidential Letter of Felicitation for Filipino centenarians reaching 100 years of age (RA 10868).',
    type: 'Cash Assistance',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'Assistive Devices Allocation (Wheelchairs, Walking Canes, Hearing Aids)',
    description: 'Free distribution of wheelchairs, walkers, quad canes, and hearing assistive devices for frail and indigent senior citizens.',
    type: 'Medical Support',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'AICS Senior Medical & Hospitalization Assistance',
    description: 'Emergency financial assistance, guarantee letters (GL), laboratory aid, and maintenance medicine subsidies for indigent elderly.',
    type: 'Health',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'AICS Senior Funeral and Burial Assistance',
    description: 'Financial assistance (₱5,000 - ₱10,000+) to support indigent families with senior citizen mortuary and burial expenses.',
    type: 'Financial Assistance',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'Senior Citizens Health & Geriatric Wellness Program',
    description: 'Periodic medical check-ups, geriatric consultations, health screening, and wellness activities in coordination with OSCA.',
    type: 'Health',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'Senior Citizens OSCA Assistance & Referral Services',
    description: 'Information dissemination, senior privileges enforcement, and referral coordination with OSCA and DSWD/NCSC.',
    type: 'Information Services',
  },
  {
    category: 'Senior Citizens (Social Pension)',
    name: 'Emergency Food & Calamity Relief for Seniors',
    description: 'Emergency family food packs and priority relief assistance during typhoons, floods, and natural disasters.',
    type: 'Emergency Relief',
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Persons with Disabilities (PWD) Programs (RA 7277, RA 10754, RA 11228)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'MSWDO Local PWD Monthly Financial Allowance',
    description: 'Monthly or quarterly municipal financial stipend (₱500–₱1,000/month funded via the 1% LGU PWD budget) for indigent PWDs.',
    type: 'Cash Assistance',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'PDAO Free Assistive Devices (Wheelchairs, Crutches, Canes)',
    description: 'Provision of customized wheelchairs, crutches, walking canes, white canes, and hearing aids via PDAO and MSWDO.',
    type: 'Medical Support',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'PWD Microenterprise & Livelihood Capital Grant',
    description: 'Start-up capital assistance (₱5,000–₱15,000) and livelihood toolkits for sari-sari stores, craft making, and home-based micro-businesses.',
    type: 'Livelihood',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'PWD Educational Subsidy & SPED Assistance',
    description: 'Annual educational financial assistance (₱2,000–₱5,000/year) and school supplies for learners with disabilities and SPED students.',
    type: 'Education',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'PWD Medical & Physical Therapy Referral Assistance',
    description: 'Subsidized physical therapy, occupational therapy sessions, medical supplies, and maintenance medicine support via RHU/partner clinics.',
    type: 'Health',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'PWD Inclusive Skills & Vocational Training Program',
    description: 'Free skills training, tech-voc livelihood courses, and computer literacy workshops in partnership with TESDA and PDAO.',
    type: 'Training/Education',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'Disaster Priority Relief & Evacuation for PWD Households',
    description: 'Targeted disaster evacuation registry, priority rescue support, and specialized emergency food and hygiene packs.',
    type: 'Emergency Relief',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'PWD Inclusive LGU Employment Facilitation (1% Mandate)',
    description: 'Workplace accommodation advocacy and priority contractual/temporary job placement within the Municipal Hall and barangays.',
    type: 'Employment',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'PDAO / PWD ID & Purchase Booklet Issuance',
    description: 'Official municipal registration, digitized PWD ID, and medicine/grocery discount booklets for statutory 20% discount and VAT exemption.',
    type: 'Administrative',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'AICS Municipal Emergency Financial Relief for PWD',
    description: 'Immediate emergency financial, medical, and transportation assistance for PWD individuals and families in crisis.',
    type: 'Emergency Relief',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'PWD ID Registration and Benefit Card Issuance',
    description: 'Official municipal registration and ID issuance for statutory 20% discounts, VAT exemption, and government social protection.',
    type: 'Administrative',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'Assistive Mobility Devices Distribution (Wheelchairs, Crutches, White Canes)',
    description: 'Distribution of mobility and sensory assistive devices including wheelchairs, crutches, white canes, and hearing aids.',
    type: 'Medical Support',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'PWD Medical, Diagnostic & Physical Therapy Assistance',
    description: 'Medical subsidies, physical and occupational therapy coverage, assistive prosthetics, and maintenance medicines via AICS.',
    type: 'Health',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'PWD Sustainable Livelihood Program (SLP-PWD Seed Capital)',
    description: 'Capital seed funding and livelihood toolkits for micro-enterprises, sari-sari stores, craft making, and home-based businesses.',
    type: 'Livelihood',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'PWD Skills & Vocational Tech-Voc Training',
    description: 'Free vocational training, livelihood workshops, and skills enhancement programs in partnership with TESDA and DSWD centers.',
    type: 'Training/Education',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'PWD Educational Assistance & SPED Learning Grant',
    description: 'Financial support, stipend, and learning supplies for learners with disabilities and Special Education (SPED) students.',
    type: 'Education',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'Local PWD Monthly / Quarterly Cash Allowance',
    description: 'LGU/municipal financial stipend to augment daily living, transportation, and nutritional needs of indigent PWDs.',
    type: 'Cash Assistance',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'PWD Inclusive Employment Facilitation',
    description: 'Job matching, workplace accommodation advocacy, and employment facilitation with local businesses and government offices.',
    type: 'Employment',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'AICS (Assistance to Individuals in Crisis Situation) for PWD',
    description: 'Immediate emergency financial and medical aid for PWD individuals and families encountering severe hardship or crisis.',
    type: 'Emergency Relief',
  },
  {
    category: 'Persons with Disabilities (PWD)',
    name: 'Disaster Preparedness & Priority Evacuation Relief',
    description: 'Disability-inclusive emergency relief, special dietary/hygiene packs, and priority disaster evacuation support.',
    type: 'Emergency Relief',
  },
];

module.exports = programsData;
