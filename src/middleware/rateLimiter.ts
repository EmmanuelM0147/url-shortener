import rateLimit from 'express-rate-limit';

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const max = Number(process.env.RATE_LIMIT_MAX) || 20;

export const createLinkRateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
