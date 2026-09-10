const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Unauthorized. User information missing.' });
    }

    const userRole = (req.user.role || '').toUpperCase();
    const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());

    // ADMIN has universal access to all staff-level routes
    if (userRole === 'ADMIN') {
      return next();
    }

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({ error: `Forbidden. Access restricted to roles: [${allowedRoles.join(', ')}]` });
    }

    next();
  };
};

module.exports = roleMiddleware;
