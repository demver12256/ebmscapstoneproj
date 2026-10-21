const ADMIN_ROLES = ['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin'];
const STAFF_ROLES = ['staff', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff'];

const expandRoles = (roles) => {
  const expanded = new Set(roles);
  // admin inherits all admin sub-roles
  if (expanded.has('admin')) {
    ADMIN_ROLES.forEach(r => expanded.add(r));
  }
  // staff inherits all staff sub-roles
  if (expanded.has('staff')) {
    STAFF_ROLES.forEach(r => expanded.add(r));
  }
  return [...expanded];
};

const authorize = (...allowedRoles) => {
  const roles = expandRoles(allowedRoles.flat());
  return (req, res, next) => {
    console.log('[AUTHORIZE] Checking authorization for:', req.user?.role, '| Allowed roles:', roles);
    
    if (!req.user) {
      console.error('[AUTHORIZE] Missing user in request');
      return res.status(401).json({ message: 'Unauthorized - no user found' });
    }

    if (!roles.includes(req.user.role)) {
      console.error(`[AUTHORIZE] User role ${req.user.role} not in allowed roles:`, roles);
      return res.status(403).json({ message: 'Forbidden: insufficient privileges' });
    }

    console.log('[AUTHORIZE] Authorization granted');
    next();
  };
};

module.exports = { authorize };
