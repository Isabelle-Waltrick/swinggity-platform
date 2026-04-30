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
// GSR10: each sensitive auth endpoint has a dedicated rate limiter applied as route-level
// middleware to enforce tighter thresholds than the global generalLimiter in index.js.
router.post('/signup', signupLimiter, signup); // POST /signup — 5 req / 15 min
// SSR08: loginLimiter applies endpoint-specific anti-abuse throttling on login attempts.
router.post('/login', loginLimiter, login); // POST /login — 5 req / 15 min (failed only)
router.post('/logout', logout); // POST /logout
router.post('/verify-email', verifyEmailLimiter, verifyEmail); // POST /verify-email — 5 req / 15 min
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword); // POST /forgot-password — 3 req / 15 min
router.post('/reset-password/:token', resetPasswordLimiter, resetPassword); // POST /reset-password/:token — 5 req / 15 min

export default router;
