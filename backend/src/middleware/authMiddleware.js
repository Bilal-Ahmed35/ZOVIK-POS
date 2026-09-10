const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');

const ACCESS_SECRET = process.env.JWT_SECRET || 'pos_system_jwt_access_secret_key_2026';

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Invalid token format.' });
  }

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    
    // Check if user is still active in database
    if (decoded.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, name: true, role: true, isActive: true, branchId: true }
      });

      if (!dbUser) {
        return res.status(401).json({ error: 'Authenticated user account no longer exists.' });
      }

      if (dbUser.isActive === false) {
        return res.status(403).json({ error: 'Your account has been deactivated or disabled by Admin.' });
      }

      req.user = {
        ...decoded,
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        branchId: dbUser.branchId,
      };
    } else {
      req.user = decoded;
    }

    // Attach session ID if provided in header
    req.sessionId = req.headers['x-session-id'] || null;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please refresh your session.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid or malformed token.' });
  }
};

/**
 * Optional authentication middleware: if token is present, decode it; if not, proceed as guest
 */
const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  req.sessionId = req.headers['x-session-id'] || null;

  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    if (decoded.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, name: true, role: true, isActive: true, branchId: true }
      });
      if (dbUser && dbUser.isActive) {
        req.user = {
          ...decoded,
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          branchId: dbUser.branchId,
        };
      }
    }
  } catch {
    req.user = null;
  }

  next();
};

module.exports = authMiddleware;
module.exports.optionalAuthMiddleware = optionalAuthMiddleware;
