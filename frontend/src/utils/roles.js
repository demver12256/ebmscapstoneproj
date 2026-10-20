export const ADMIN_ROLES = ['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin'];
export const MSWDO_ROLES = ['mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'mswdo_staff'];
export const STAFF_ROLES = ['staff', 'mswdo_staff'];

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);
export const isMswdoRole = (role) => MSWDO_ROLES.includes(role);
export const isMswdoStaff = (role) => role === 'mswdo_staff';
export const isStaffRole = (role) => STAFF_ROLES.includes(role);
export const isAdminOr = (role, ...others) => isAdminRole(role) || others.includes(role);
