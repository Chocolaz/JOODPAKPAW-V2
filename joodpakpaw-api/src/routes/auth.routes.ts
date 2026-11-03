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
} from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

export const authRouter = Router();

authRouter.post('/sign-up', signUp);
authRouter.post('/verify-otp', verifyOtp);
authRouter.post('/resend-otp', resendOtp);
authRouter.post('/sign-in', signIn);
authRouter.post('/refresh-token', refreshToken);
authRouter.post('/forgot-password', forgotPassword);
authRouter.post('/reset-password', resetPassword);
authRouter.get('/profile', authenticateToken, getProfile);
