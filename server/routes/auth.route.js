import express from 'express';
import {
    forgotPassword,
    login,
    logout,
    resetPassword,
    signup,
    verify,
    verifyEmail,
} from '../controllers/auth.controllers.js';
import { verifyToken } from '../middleware/verifyToken.js';
import {
    forgotPasswordLimiter,
    loginLimiter,
    resetPasswordLimiter,
    signupLimiter,
    verifyEmailLimiter,
} from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/verify', verifyToken, verify);
router.post('/signup', signupLimiter, signup);
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.post('/verify-email', verifyEmailLimiter, verifyEmail);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password/:token', resetPasswordLimiter, resetPassword);

export default router;
