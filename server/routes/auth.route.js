// importing express framework
import express from 'express';
// importing controller functions for auth operations
import { signup, login, logout } from '../controllers/auth.controllers.js';
// create a router instance for authentication routes
const router = express.Router();

// POST route for user signup/registration
router.get('/signup', signup);

// POST route for user login
router.get('/login', login);

// GET route for user logout
router.get('/logout', logout);

// Export the router to be used in main application
export default router;