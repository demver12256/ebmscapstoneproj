// Utility for generating dummy beneficiary details when blank
// Formats follow:
// Contact Number: +639XXXXXXXXX (e.g., +639366306362)
// Birthdate: YYYY-MM-DD where year >= 1985 (di bababa sa 1985)
// Sex: 'Female' or 'Male'

const PH_MOBILE_PREFIXES = [
  '915', '916', '917', '926', '927', '935', '936', '945', '955', '956', '965', '966', '975', '977', // Globe / TM
  '907', '908', '909', '910', '912', '918', '919', '920', '921', '928', '929', '938', '939', '946', '947', '948', '949', '950', '951', '961', '970', '981', '989', '998', '999', // Smart / TNT
  '922', '923', '925', '931', '932', '933', '934', '941', '942', '943', '944', // Sun
  '991', '992', '993', '994', // DITO
];

function generateDummyContactNumber() {
  const prefix = PH_MOBILE_PREFIXES[Math.floor(Math.random() * PH_MOBILE_PREFIXES.length)];
  const remainingDigits = Math.floor(1000000 + Math.random() * 9000000).toString(); // 7 digits
  return `+63${prefix}${remainingDigits}`;
}

function generateDummyBirthdate(options = {}) {
  // Year must not be lower than 1985 (di bababa sa 1985)
  // Default range: 1985 to 2003 (adult age 23-41)
  const minYear = 1985;
  const maxYear = options.maxYear || 2003;
  const year = Math.floor(minYear + Math.random() * (maxYear - minYear + 1));
  const month = String(Math.floor(1 + Math.random() * 12)).padStart(2, '0');
  const day = String(Math.floor(1 + Math.random() * 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function inferDummySex(firstName) {
  if (!firstName) return Math.random() > 0.5 ? 'Female' : 'Male';
  const name = String(firstName).trim().toLowerCase();
  
  const femaleKeywords = [
    'maria', 'mary', 'ana', 'anne', 'dianne', 'diane', 'rose', 'lyn', 'mae', 'joy',
    'grace', 'jean', 'jocelyn', 'marites', 'maricel', 'cristina', 'rowena', 'gemma',
    'lorna', 'elena', 'charlene', 'judy', 'jennifer', 'angelica', 'lea', 'fatima',
    'catherine', 'hazel', 'mercy', 'glenda', 'rebecca', 'florence', 'clarita', 'teresa',
    'luz', 'lourdes', 'concepcion', 'esmeralda', 'beverly', 'cherrie', 'sheryl', 'althea'
  ];
  if (femaleKeywords.some((k) => name.includes(k))) return 'Female';
  if (name.endsWith('a') || name.endsWith('ie') || name.endsWith('lyn') || name.endsWith('ette') || name.endsWith('een')) {
    return 'Female';
  }

  const maleKeywords = [
    'john', 'juan', 'mark', 'jose', 'paul', 'peter', 'james', 'michael', 'robert',
    'richard', 'edward', 'david', 'jomar', 'joel', 'rolando', 'renato', 'antonio',
    'pedro', 'manuel', 'ramon', 'rodrigo', 'ferdinand', 'benigno', 'dante', 'efren',
    'vicente', 'fernando', 'marlon', 'jayson', 'christian', 'angelito', 'crisanto'
  ];
  if (maleKeywords.some((k) => name.includes(k))) return 'Male';
  if (name.endsWith('o') || name.endsWith('or') || name.endsWith('el') || name.endsWith('rd')) {
    return 'Male';
  }

  return Math.random() > 0.5 ? 'Female' : 'Male';
}

/**
 * Checks a beneficiary object and returns an object with patched dummy values
 * if any of contact_number, sex, or birthdate are blank/unfilled.
 */
function fillBeneficiaryDummyDetails(beneficiaryData) {
  const patch = {};

  // 1. Contact number
  const rawContact = beneficiaryData.contact_number ? String(beneficiaryData.contact_number).trim() : '';
  const isBlankContact = !rawContact || rawContact === '—' || rawContact === '-' || rawContact === 'null' || rawContact === 'undefined';
  if (isBlankContact) {
    patch.contact_number = generateDummyContactNumber();
  }

  // 2. Sex
  const rawSex = beneficiaryData.sex ? String(beneficiaryData.sex).trim() : '';
  const isBlankSex = !rawSex || rawSex.toLowerCase() === 'other' || rawSex === '—' || rawSex === '-';
  if (isBlankSex) {
    patch.sex = inferDummySex(beneficiaryData.first_name);
  }

  // 3. Birthdate
  const rawBday = beneficiaryData.birthdate ? String(beneficiaryData.birthdate).trim() : '';
  const isBlankBday = !rawBday || rawBday === '2000-01-01' || rawBday === '0000-00-00' || rawBday === '—' || rawBday === '-';
  if (isBlankBday) {
    patch.birthdate = generateDummyBirthdate();
  } else {
    // If year is below 1985 and category is not senior citizen, ensure not below 1985
    const match = rawBday.match(/^(\d{4})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const isSenior = beneficiaryData.category && String(beneficiaryData.category).toLowerCase().includes('senior');
      if (year < 1985 && !isSenior) {
        patch.birthdate = generateDummyBirthdate();
      }
    }
  }

  // 4. Sitio
  const rawSitio = beneficiaryData.sitio ? String(beneficiaryData.sitio).trim() : '';
  if (!rawSitio || rawSitio === '—' || rawSitio === '-') {
    patch.sitio = 'Centro';
  }

  return patch;
}

module.exports = {
  generateDummyContactNumber,
  generateDummyBirthdate,
  inferDummySex,
  fillBeneficiaryDummyDetails,
};
