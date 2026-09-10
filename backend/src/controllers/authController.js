const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('../config/db');
const { sendOTPEmail } = require('../services/emailService');
const { logAudit } = require('../middleware/auditMiddleware');

const ACCESS_SECRET = process.env.JWT_SECRET || 'pos_system_jwt_access_secret_key_2026';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'pos_system_jwt_refresh_secret_key_2026';

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, branchId: user.branchId },
    ACCESS_SECRET,
    { expiresIn: '7d' }
  );
  const refreshToken = jwt.sign(
    { id: user.id, email: user.email },
    REFRESH_SECRET,
    { expiresIn: '30d' }
  );
  return { accessToken, refreshToken };
};

/**
 * Staff and Customer Registration
 */
const register = async (req, res) => {
  const { email, password, name, role, branchId } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role && ['CUSTOMER', 'VENDOR', 'KITCHEN', 'ADMIN'].includes(role.toUpperCase())
      ? role.toUpperCase()
      : 'CUSTOMER';

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name.trim(),
        role: userRole,
        branchId: branchId ? parseInt(branchId, 10) : 1,
        isActive: true,
      },
    });

    const tokens = generateTokens(user);

    await logAudit({
      userId: user.id,
      action: 'USER_REGISTERED',
      entity: 'User',
      entityId: user.id,
      newValue: { email: user.email, role: user.role },
      req,
    });

    return res.status(201).json({
      message: 'User registered successfully.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
      ...tokens,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
};

/**
 * Staff and User Login (Email + Password)
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ error: 'Your account has been deactivated or disabled by Admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const tokens = generateTokens(user);

    await logAudit({
      userId: user.id,
      action: 'STAFF_LOGIN',
      entity: 'User',
      entityId: user.id,
      req,
    });

    return res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        branchId: user.branchId,
      },
      ...tokens,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
};

/**
 * Refresh JWT Access Token using valid Refresh Token
 */
const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  try {
    const decoded = jwt.verify(token, REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || user.isActive === false) {
      return res.status(403).json({ error: 'User is inactive or no longer exists.' });
    }

    const tokens = generateTokens(user);
    return res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
};

/**
 * Get current profile
 */
const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, isActive: true, branchId: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ error: 'Internal server error fetching profile.' });
  }
};

/**
 * Send persistent 6-digit OTP code to email
 */
const sendOTP = async (req, res) => {
  const { email, name, sessionId } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Check for active unexpired OTP to enforce resend cooldown (30 seconds)
    const recentOTP = await prisma.emailOTP.findFirst({
      where: {
        email: normalizedEmail,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentOTP) {
      const elapsedMs = Date.now() - new Date(recentOTP.createdAt).getTime();
      if (elapsedMs < 30000) {
        const waitSec = Math.ceil((30000 - elapsedMs) / 1000);
        return res.status(429).json({ error: `Please wait ${waitSec} seconds before requesting another code.` });
      }

      // Invalidate older active OTPs for this email
      await prisma.emailOTP.deleteMany({
        where: { email: normalizedEmail, verifiedAt: null },
      });
    }

    // Generate random secure 6-digit OTP
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // Validate session ID in database to prevent foreign key constraint violation
    let validSessionId = null;
    if (sessionId) {
      const existingSession = await prisma.session.findUnique({ where: { id: sessionId } });
      if (existingSession) {
        validSessionId = sessionId;
      }
    }

    await prisma.emailOTP.create({
      data: {
        email: normalizedEmail,
        sessionId: validSessionId,
        codeHash,
        expiresAt,
        attempts: 0,
      },
    });

    // Send email asynchronously
    sendOTPEmail(normalizedEmail, name, rawOtp).catch(err =>
      console.error('[OTP Email] Failed to send email:', err.message)
    );

    return res.json({
      success: true,
      message: 'Verification code sent to your email. Valid for 5 minutes.',
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ error: 'Failed to generate verification OTP.' });
  }
};

/**
 * Verify persistent OTP code and attach user to session
 */
const verifyOTP = async (req, res) => {
  const { email, name, otp, sessionId } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const inputHash = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');

  try {
    const otpRecord = await prisma.emailOTP.findFirst({
      where: {
        email: normalizedEmail,
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'No active OTP request found. Please request a new code.' });
    }

    if (new Date() > new Date(otpRecord.expiresAt)) {
      await prisma.emailOTP.delete({ where: { id: otpRecord.id } });
      return res.status(400).json({ error: 'OTP code has expired. Please request a new code.' });
    }

    if (otpRecord.attempts >= 5) {
      await prisma.emailOTP.delete({ where: { id: otpRecord.id } });
      return res.status(429).json({ error: 'Maximum verification attempts exceeded. Please request a new code.' });
    }

    if (otpRecord.codeHash !== inputHash) {
      const newAttempts = otpRecord.attempts + 1;
      await prisma.emailOTP.update({
        where: { id: otpRecord.id },
        data: { attempts: newAttempts },
      });
      const remaining = 5 - newAttempts;
      return res.status(400).json({ error: `Incorrect verification code. ${remaining} attempt(s) remaining.` });
    }

    // Mark OTP as verified
    await prisma.emailOTP.update({
      where: { id: otpRecord.id },
      data: { verifiedAt: new Date() },
    });

    // Create or find customer user
    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      const defaultPassword = await bcrypt.hash('guest_customer_password_2026', 10);
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name ? name.trim() : 'Guest Customer',
          password: defaultPassword,
          role: 'CUSTOMER',
          isActive: true,
        },
      });
    } else if (name && name.trim() !== '' && user.name !== name.trim()) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: name.trim() },
      });
    }

    // If active sessionId provided, link customer to the session
    if (sessionId) {
      await prisma.session.updateMany({
        where: { id: sessionId },
        data: { customerId: user.id },
      });
    }

    const tokens = generateTokens(user);

    return res.json({
      success: true,
      message: 'Email verified successfully.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ error: 'Failed to verify code.' });
  }
};

/**
 * Logout
 */
const logout = async (req, res) => {
  if (req.user) {
    await logAudit({
      userId: req.user.id,
      action: 'USER_LOGOUT',
      entity: 'User',
      entityId: req.user.id,
      req,
    });
  }
  return res.json({ message: 'Logged out successfully.' });
};

module.exports = {
  register,
  login,
  refreshToken,
  getProfile,
  sendOTP,
  verifyOTP,
  logout,
};
