// In-memory sliding window rate limiter
const requestBuckets = new Map();

/**
 * Creates a rate limiting middleware
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests allowed per window
 * @param {string} options.message - Error message when limit is exceeded
 * @param {function} [options.keyGenerator] - Custom key generator function
 */
const createRateLimiter = ({ windowMs = 60000, max = 100, message = 'Too many requests, please try again later.', keyGenerator }) => {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test' || req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1') {
      return next();
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown-ip';
    const key = keyGenerator ? keyGenerator(req) : `${ip}:${req.baseUrl || req.path}`;
    const now = Date.now();

    let bucket = requestBuckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      requestBuckets.set(key, bucket);
    }

    // Filter out timestamps outside the sliding window
    bucket.timestamps = bucket.timestamps.filter(ts => now - ts < windowMs);

    if (bucket.timestamps.length >= max) {
      const oldest = bucket.timestamps[0];
      const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: message,
        retryAfterSeconds: retryAfterSec,
      });
    }

    bucket.timestamps.push(now);
    next();
  };
};

// Cleanup old empty buckets every 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of requestBuckets.entries()) {
    bucket.timestamps = bucket.timestamps.filter(ts => now - ts < 900000);
    if (bucket.timestamps.length === 0) {
      requestBuckets.delete(key);
    }
  }
}, 600000);

// Specific rate limiters
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: 'Too many login attempts. Please wait 15 minutes before trying again.',
  keyGenerator: (req) => `auth:${req.ip || 'ip'}:${(req.body?.email || '').toLowerCase()}`,
});

const otpLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: 'Too many OTP requests. Please wait a few minutes before requesting a new code.',
  keyGenerator: (req) => `otp:${req.ip || 'ip'}:${(req.body?.email || '').toLowerCase()}`,
});

const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: 'High traffic detected. Please slow down.',
});

module.exports = {
  createRateLimiter,
  authLimiter,
  otpLimiter,
  generalLimiter,
};
