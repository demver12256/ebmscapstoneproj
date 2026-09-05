export const ADMIN_ROLES = ['admin', 'mswdo_admin'];
export const isAdminRole = (role) => ADMIN_ROLES.includes(role);
export const isAdminOr = (role, ...others) => isAdminRole(role) || others.includes(role);
