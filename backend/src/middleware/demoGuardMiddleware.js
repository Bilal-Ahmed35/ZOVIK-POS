/**
 * Demo Sandbox Guard Middleware
 * Blocks CRUD write operations (POST, PUT, DELETE, PATCH) for Demo accounts only.
 * Demo accounts: demo.admin@testpos.local, demo.cashier@testpos.local, demo.kitchen@testpos.local
 * All other accounts (real users) have full access.
 * 
 * NOTE: isDemo flag is set by authMiddleware using DEMO_EMAILS exact list.
 * Do NOT use email.includes() here — always rely on req.user.isDemo.
 */
const demoGuardMiddleware = (req, res, next) => {
  // Only block if user is explicitly flagged as a demo account
  if (req.user && req.user.isDemo === true) {
    const isWriteMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method.toUpperCase());
    const isAuthRoute = req.originalUrl.includes('/api/auth');

    if (isWriteMutation && !isAuthRoute) {
      console.log(`[DEMO GUARD] 🔒 Blocked ${req.method} on ${req.originalUrl} for demo user (${req.user.email}).`);

      return res.status(403).json({
        error: '🔒 Read-Only Demo Mode: Actions & updates are disabled for demo accounts. Please log in with a real account to perform changes.',
        isDemo: true,
      });
    }
  }

  next();
};

module.exports = demoGuardMiddleware;
