const jwt = require('jsonwebtoken');
const { User } = require('../db');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  console.log('[AUTHENTICATE]', {
    method: req.method,
    path: req.path,
    hasAuthHeader: !!authHeader,
    authHeaderValue: authHeader ? authHeader.substring(0, 20) + '...' : 'NONE'
  });

  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[AUTHENTICATE] Missing or malformed Bearer token');
    return res.status(401).json({ message: 'Unauthorized access - no valid Bearer token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.id);
    console.log('[AUTHENTICATE] User found:', {
      userId: user?.id,
      userStatus: user?.status,
      userRole: user?.role
    });

    if (!user) {
      console.error('[AUTHENTICATE] User not found');
      return res.status(401).json({ message: 'Unauthorized access - user not found' });
    }
    
    // Allow inactive users to access, but pass status to routes
    // Routes can decide how to handle inactive users
    req.user = user;
    next();
  } catch (error) {
    console.error('[AUTHENTICATE] Token verification failed:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
