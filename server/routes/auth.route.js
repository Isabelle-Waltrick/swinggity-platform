// importing express framework
import express from 'express';

// create a router instance for authentication routes
const router = express.Router();

// POST route for user signup/registration
router.get('/signup', (req, res) => {
    res.send('Signup route');
});

// POST route for user login
router.get('/login', (req, res) => {
    res.send('Login route');
});

// GET route for user logout
router.get('/logout', (req, res) => {
    res.send('Logout route');
});

// Export the router to be used in main application
export default router;