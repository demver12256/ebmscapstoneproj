const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.error('[AUTHORIZE] Missing user in request');
      return res.status(401).json({ message: 'Unauthorized - no user found' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.error(`[AUTHORIZE] User role ${req.user.role} not in allowed roles:`, allowedRoles);
      return res.status(403).json({ message: 'Forbidden: insufficient privileges' });
    }

    next();
  };
};

module.exports = { authorize };
