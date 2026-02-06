// importing express framework
import express from 'express';
// importing controller functions for auth operations
import { signup, login, logout, verifyEmail, forgotPassword, resetPassword, checkAuth } from '../controllers/auth.controllers.js';
// importing middleware to verify JWT tokens
import { verifyToken } from "../middleware/verifyToken.js";
// importing rate limiters to prevent brute force and DoS attacks
import {
    signupLimiter,
    loginLimiter,
    forgotPasswordLimiter,
    resetPasswordLimiter,
    verifyEmailLimiter
} from "../middleware/rateLimiter.js";

// create a router instance for authentication routes
const router = express.Router();

// verify JWT token for protected routes
router.get("/check-auth", verifyToken, checkAuth);

// POST route for user signup/registration (rate limited: 5 attempts per 15 min)
router.post('/signup', signupLimiter, signup);

// POST route for user login (rate limited: 5 attempts per 15 min)
router.post('/login', loginLimiter, login);

// POST route for user logout (no rate limit needed)
router.post('/logout', logout);

// POST route for email verification (rate limited: 5 attempts per 15 min)
router.post('/verify-email', verifyEmailLimiter, verifyEmail);

// POST route for password reset request (rate limited: 3 attempts per 15 min)
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);

// POST route for password reset (rate limited: 5 attempts per 15 min)
router.post('/reset-password/:token', resetPasswordLimiter, resetPassword);

// Export the router to be used in main application
export default router;