// import express framework
import express from 'express';
// import controller functions for auth operations
import { signup, login, logout } from '../controllers/auth.controllers.js';

// create a router instance for authentication routes
const router = express.Router();

// route for user signup/registration
export const signup = async (req, res) => {
    res.send('Signup route');
};

// route for user login
export const login = async (req, res) => {
    res.send('Signup route');
};

// route for user logout
export const logout = async (req, res) => {
    res.send('Signup route');
};

// Export the router to be mounted in the main application
export default router;