// Central role helpers — mswdo_admin manages municipal programs (Senior Citizens, PWD, and 4Ps beneficiaries)
const { Op } = require('sequelize');
const ADMIN_ROLES = ['admin', 'mswdo_admin'];
const MSWDO_ROLES = ['mswdo_admin'];
const isAdminRole = (role) => ADMIN_ROLES.includes(role);
const isMswdoRole = (role) => MSWDO_ROLES.includes(role);
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
  if (isMswdoRole(role)) return MSWDO_CATEGORY_FILTER;
  return null;
};

const isMswdoCategory = (category) => {
  if (!category) return false;
  const c = String(category).toLowerCase();
  return c.includes('senior') || c.includes('pwd') || c.includes('disabilit') || c.includes('4ps') || c.includes('pantawid');
};

const isMswdoEligibility = (category) => {
  if (!category) return true;
  const c = String(category).toLowerCase();
  return c.includes('senior') || c.includes('pwd') || c.includes('disabilit') || c.includes('4ps') || c.includes('pantawid');
};

module.exports = { ADMIN_ROLES, MSWDO_ROLES, isAdminRole, isMswdoRole, isAdminOr, MSWDO_CATEGORY_FILTER, MSWDO_ELIGIBILITY_FILTER, getCategoryFilterForRole, isMswdoCategory, isMswdoEligibility };
