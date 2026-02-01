// importing express framework
import express from 'express';
// importing controller functions for auth operations
import { signup, login, logout, verifyEmail, forgotPassword, resetPassword, checkAuth } from '../controllers/auth.controllers.js';
// importing middleware to verify JWT tokens
import { verifyToken } from "../middleware/verifyToken.js";
// create a router instance for authentication routes
const router = express.Router();

// verify JWT token for protected routes
router.get("/check-auth", verifyToken, checkAuth);

// POST route for user signup/registration
router.post('/signup', signup);

// POST route for user login
router.post('/login', login);

// POST route for user logout
router.post('/logout', logout);

// POST route for email verification
router.post('/verify-email', verifyEmail);

// POST route for password reset request
router.post('/forgot-password', forgotPassword);

// POST route for password reset request
router.post('/reset-password/:token', resetPassword);

// Export the router to be used in main application
export default router;