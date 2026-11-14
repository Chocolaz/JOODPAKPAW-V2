import { Router } from 'express';
import {
  signUp,
  verifyOtp,
  resendOtp,
  signIn,
  refreshToken,
  forgotPassword,
  resetPassword,
  getProfile,
  signOut,
} from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import {
  authLimiter,
  otpLimiter,
  forgotPasswordLimiter,
} from '../middlewares/rateLimiter';

export const authRouter = Router();

authRouter.post('/sign-up', otpLimiter, signUp);
authRouter.post('/verify-otp', verifyOtp);
authRouter.post('/resend-otp', otpLimiter, resendOtp);
authRouter.post('/sign-in', authLimiter, signIn);
authRouter.post('/refresh-token', refreshToken);
authRouter.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
authRouter.post('/reset-password', resetPassword);
authRouter.get('/profile', authenticateToken, getProfile);
authRouter.post('/sign-out', authenticateToken, signOut);
