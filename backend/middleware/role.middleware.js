const ADMIN_ROLES = ['admin', 'mswdo_admin'];

const expandRoles = (roles) => {
  const expanded = new Set(roles);
  // mswdo_admin inherits all admin permissions
  if (expanded.has('admin')) {
    ADMIN_ROLES.forEach(r => expanded.add(r));
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
