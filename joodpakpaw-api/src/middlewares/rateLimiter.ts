import rateLimit from 'express-rate-limit';

const createLimiterHandler = (message: string) => (_req: any, res: any) => {
  res.status(429).json({
    code: 'RATE_LIMIT_EXCEEDED',
    message,
  });
};

const defaultOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false, xForwardedForHeader: false, default: false },
  keyGenerator: (req: any) =>
    req.ip ||
    (req.headers['x-forwarded-for'] as string) ||
    req.socket?.remoteAddress ||
    '127.0.0.1',
  skip: () => process.env.NODE_ENV === 'test',
};

/**
 * 10 requests per 1 minute for /sign-in
 */
export const authLimiter = rateLimit({
  ...defaultOptions,
  windowMs: 1 * 60 * 1000,
  limit: 10,
  handler: createLimiterHandler(
    'Too many sign-in attempts. Please try again after 1 minute.'
  ),
});

/**
 * 5 requests per 5 minutes for /sign-up and /resend-otp
 */
export const otpLimiter = rateLimit({
  ...defaultOptions,
  windowMs: 5 * 60 * 1000,
  limit: 5,
  handler: createLimiterHandler(
    'Too many OTP requests. Please try again after 5 minutes.'
  ),
});

/**
 * 5 requests per 15 minutes for /forgot-password
 */
export const forgotPasswordLimiter = rateLimit({
  ...defaultOptions,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  handler: createLimiterHandler(
    'Too many password reset requests. Please try again after 15 minutes.'
  ),
});
