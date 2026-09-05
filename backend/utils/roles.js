// Central role helpers — mswdo_admin focuses strictly on Senior Citizens & PWD programs (4Ps programs belong exclusively to DSWD)
const { Op } = require('sequelize');
const ADMIN_ROLES = ['admin', 'mswdo_admin'];
const MSWDO_ROLES = ['mswdo_admin'];
const isAdminRole = (role) => ADMIN_ROLES.includes(role);
const isMswdoRole = (role) => MSWDO_ROLES.includes(role);
const isAdminOr = (role, ...others) => isAdminRole(role) || others.includes(role);

// MSWDO category filter for beneficiaries (Senior & PWD)
const MSWDO_CATEGORY_FILTER = {
  [Op.or]: [
    { category: { [Op.like]: '%Senior%' } },
    { category: { [Op.like]: '%PWD%' } },
    { category: { [Op.like]: '%Disabilit%' } },
  ]
};

// MSWDO program eligibility filter — strictly Senior Citizens and PWD only (4Ps is strictly DSWD)
const MSWDO_ELIGIBILITY_FILTER = {
  [Op.or]: [
    { eligibility_category: { [Op.like]: '%Senior%' } },
    { eligibility_category: { [Op.like]: '%PWD%' } },
    { eligibility_category: { [Op.like]: '%Disabilit%' } },
  ]
};

const getCategoryFilterForRole = (role) => {
  if (isMswdoRole(role)) return MSWDO_CATEGORY_FILTER;
  return null;
};

const isMswdoCategory = (category) => {
  if (!category) return false;
  const c = String(category).toLowerCase();
  // 4Ps is strictly for DSWD, not MSWDO
  if (c.includes('4ps') || c.includes('pantawid')) return false;
  return c.includes('senior') || c.includes('pwd') || c.includes('disabilit');
};

const isMswdoEligibility = (category) => {
  if (!category) return false;
  const c = String(category).toLowerCase();
  // 4Ps programs cannot be accessed, created, or managed by MSWDO
  if (c.includes('4ps') || c.includes('pantawid')) return false;
  return c.includes('senior') || c.includes('pwd') || c.includes('disabilit');
};

module.exports = { ADMIN_ROLES, MSWDO_ROLES, isAdminRole, isMswdoRole, isAdminOr, MSWDO_CATEGORY_FILTER, MSWDO_ELIGIBILITY_FILTER, getCategoryFilterForRole, isMswdoCategory, isMswdoEligibility };
