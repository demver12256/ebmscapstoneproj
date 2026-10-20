// Central role helpers — mswdo_admin, senior_citizen_admin, pwd_admin manage municipal programs
const { Op } = require('sequelize');
const ADMIN_ROLES = ['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin'];
const MSWDO_ROLES = ['mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'mswdo_staff'];
const STAFF_ROLES = ['staff', 'mswdo_staff'];
const isAdminRole = (role) => ADMIN_ROLES.includes(role);
const isMswdoRole = (role) => MSWDO_ROLES.includes(role);
const isSeniorRole = (role) => role === 'senior_citizen_admin';
const isPwdRole = (role) => role === 'pwd_admin';
const isMswdoStaff = (role) => role === 'mswdo_staff';
const isAdminOr = (role, ...others) => isAdminRole(role) || others.includes(role);

// MSWDO category filter for beneficiaries: includes 4Ps, Senior Citizens & PWD for municipal registry oversight
const MSWDO_CATEGORY_FILTER = {
  [Op.or]: [
    { category: { [Op.like]: '%Senior%' } },
    { category: { [Op.like]: '%PWD%' } },
    { category: { [Op.like]: '%Disabilit%' } },
    { category: { [Op.like]: '%4Ps%' } },
    { category: { [Op.like]: '%Pantawid%' } },
  ]
};

const SENIOR_CATEGORY_FILTER = {
  category: { [Op.like]: '%Senior%' }
};

const PWD_CATEGORY_FILTER = {
  [Op.or]: [
    { category: { [Op.like]: '%PWD%' } },
    { category: { [Op.like]: '%Disabilit%' } }
  ]
};

// MSWDO program eligibility filter — includes 4Ps, Senior Citizens, and PWD
const MSWDO_ELIGIBILITY_FILTER = {
  [Op.or]: [
    { eligibility_category: { [Op.like]: '%Senior%' } },
    { eligibility_category: { [Op.like]: '%PWD%' } },
    { eligibility_category: { [Op.like]: '%Disabilit%' } },
    { eligibility_category: { [Op.like]: '%4Ps%' } },
    { eligibility_category: { [Op.like]: '%Pantawid%' } },
  ]
};

const getCategoryFilterForRole = (role) => {
  if (role === 'senior_citizen_admin') return SENIOR_CATEGORY_FILTER;
  if (role === 'pwd_admin') return PWD_CATEGORY_FILTER;
  if (isMswdoRole(role)) return MSWDO_CATEGORY_FILTER;
  return null;
};

const isMswdoCategory = (category, role) => {
  if (!category) return false;
  const c = String(category).toLowerCase();
  if (role === 'senior_citizen_admin') return c.includes('senior');
  if (role === 'pwd_admin') return c.includes('pwd') || c.includes('disabilit');
  return c.includes('senior') || c.includes('pwd') || c.includes('disabilit') || c.includes('4ps') || c.includes('pantawid');
};

const isMswdoEligibility = (category, role) => {
  if (!category) return true;
  const c = String(category).toLowerCase();
  if (role === 'senior_citizen_admin') return c.includes('senior');
  if (role === 'pwd_admin') return c.includes('pwd') || c.includes('disabilit');
  return c.includes('senior') || c.includes('pwd') || c.includes('disabilit') || c.includes('4ps') || c.includes('pantawid');
};


/**
 * Resolves the SMS/Notification Brand Prefix based on user role, creator, agency, or target category:
 * - senior_citizen_admin -> "BeniAid OSCA Bongabong"
 * - pwd_admin -> "BeniAid PWDO Bongabong"
 * - mswdo_admin / mswdo_staff -> "BeniAid MSWDO Bongabong"
 * - admin / staff / barangay / DSWD -> "BeniAid DSWD Bongabong"
 */
const getOfficeBrand = (source, fallbackAgency = 'DSWD') => {
  if (!source) {
    const fb = String(fallbackAgency).toUpperCase();
    if (fb === 'MSWDO') return 'BeniAid MSWDO Bongabong';
    if (fb === 'OSCA') return 'BeniAid OSCA Bongabong';
    if (fb === 'PWDO' || fb === 'PDAO') return 'BeniAid PWDO Bongabong';
    return 'BeniAid DSWD Bongabong';
  }

  // If source is a string (e.g. role name or agency name)
  if (typeof source === 'string') {
    const s = source.toLowerCase();
    if (s === 'senior_citizen_admin' || s === 'osca') {
      return 'BeniAid OSCA Bongabong';
    }
    if (s === 'pwd_admin' || s === 'pwdo' || s === 'pdao') {
      return 'BeniAid PWDO Bongabong';
    }
    if (s === 'mswdo_admin' || s === 'mswdo_staff' || s === 'mswdo') {
      return 'BeniAid MSWDO Bongabong';
    }
    if (s.includes('senior')) return 'BeniAid OSCA Bongabong';
    if (s.includes('pwd') || s.includes('disabilit')) return 'BeniAid PWDO Bongabong';
    return 'BeniAid DSWD Bongabong';
  }

  // If source is a user or entity object
  const role = source.role || source.User?.role || source.CreatedBy?.role || source.Creator?.role || source.Reviewer?.role || source.created_by_role;
  if (role === 'senior_citizen_admin') return 'BeniAid OSCA Bongabong';
  if (role === 'pwd_admin') return 'BeniAid PWDO Bongabong';
  if (role === 'mswdo_admin' || role === 'mswdo_staff') return 'BeniAid MSWDO Bongabong';
  if (role === 'admin' || role === 'staff' || role === 'barangay') return 'BeniAid DSWD Bongabong';

  // Check agency
  const agency = source.agency || source.Agency || source.Program?.agency;
  if (agency) {
    const ag = String(agency).toUpperCase();
    if (ag === 'OSCA') return 'BeniAid OSCA Bongabong';
    if (ag === 'PWDO' || ag === 'PDAO') return 'BeniAid PWDO Bongabong';
    if (ag === 'MSWDO') return 'BeniAid MSWDO Bongabong';
    if (ag === 'DSWD') return 'BeniAid DSWD Bongabong';
  }

  // Check target_programs / sector / title
  const programs = Array.isArray(source.target_programs) ? source.target_programs.join(' ') : String(source.target_programs || '');
  const title = String(source.title || '');
  const cat = String(source.target_category || source.category || '').toLowerCase();
  if (cat.includes('senior') || programs.toLowerCase().includes('senior') || title.toLowerCase().includes('senior citizen')) {
    return 'BeniAid OSCA Bongabong';
  }
  if (cat.includes('pwd') || cat.includes('disabilit') || programs.toLowerCase().includes('pwd') || title.toLowerCase().includes('pwd')) {
    return 'BeniAid PWDO Bongabong';
  }

  return 'BeniAid DSWD Bongabong';
};

const getOfficeName = (source) => {
  const brand = getOfficeBrand(source);
  if (brand.includes('OSCA')) return 'Tanggapan ng OSCA / MSWDO';
  if (brand.includes('PWDO')) return 'Tanggapan ng PWDO / MSWDO';
  if (brand.includes('MSWDO')) return 'Tanggapan ng MSWDO';
  return 'Tanggapan ng DSWD';
};

module.exports = {
  getOfficeBrand,
  getOfficeName, 
  ADMIN_ROLES, 
  MSWDO_ROLES, 
  STAFF_ROLES, 
  isMswdoStaff, 
  isAdminRole, 
  isMswdoRole, 
  isSeniorRole,
  isPwdRole,
  isAdminOr, 
  MSWDO_CATEGORY_FILTER, 
  SENIOR_CATEGORY_FILTER,
  PWD_CATEGORY_FILTER,
  MSWDO_ELIGIBILITY_FILTER, 
  getCategoryFilterForRole, 
  isMswdoCategory, 
  isMswdoEligibility 
};
