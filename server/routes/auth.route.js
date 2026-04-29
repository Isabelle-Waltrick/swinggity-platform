// The code in this file were created with help of AI (Copilot)

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

router.get('/verify', verifyToken, verify); // GET /verify
router.post('/signup', signupLimiter, signup); // POST /signup
router.post('/login', loginLimiter, login); // POST /login
router.post('/logout', logout); // POST /logout
router.post('/verify-email', verifyEmailLimiter, verifyEmail); // POST /verify-email
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword); // POST /forgot-password
router.post('/reset-password/:token', resetPasswordLimiter, resetPassword); // POST /reset-password/:token

export default router;
