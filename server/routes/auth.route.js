// importing express framework
import express from 'express';
// importing controller functions for auth operations
import { signup, login, logout, verifyEmail } from '../controllers/auth.controllers.js';
// create a router instance for authentication routes
const router = express.Router();

// POST route for user signup/registration
router.post('/signup', signup);

// POST route for user login
router.post('/login', login);

// POST route for user logout
router.post('/logout', logout);

// POST route for email verification
router.post('/verify-email', verifyEmail);

// Export the router to be used in main application
export default router;