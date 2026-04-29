// The code in this file were created with help of AI (Copilot)

// The main entry point for the Swinggity server application. This file sets up the Express server, configures middleware, connects to the database, and mounts all route handlers for the API.

// Node.js built-ins used for resolving file paths in ESM
import path from 'path';
import { fileURLToPath } from 'url';
// External dependencies for middleware, security, config, and server setup
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
// Local infrastructure and middleware
import { connectDB } from './db/connectDB.js';
import { csrfProtection } from './middleware/csrfProtection.js';
import { generalLimiter } from './middleware/rateLimiter.js';
// Feature route modules
import authRoutes from './routes/auth.route.js';
import calendarRoutes from './routes/calendar.route.js';
import feedbackRoutes from './routes/feedback.route.js';
import jamCircleRoutes from './routes/jamCircle.route.js';
import memberRoutes from './routes/member.route.js';
import memberSafetyRoutes from './routes/memberSafety.route.js';
import organisationRoutes from './routes/organisation.route.js';
import profileRoutes from './routes/profile.route.js';
// CSRF helpers for token generation and cookie secret handling
import { createCsrfToken, ensureCsrfSecretCookie } from './utils/csrf.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// configure dotenv to load variables from .env file
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();


// create an express application
const app = express();
// define the port from environment variables or default to 5000
const PORT = process.env.PORT || 5000;


// Trust first proxy (required for rate limiting behind reverse proxies)
app.set('trust proxy', 1);

// Use helmet for security headers (disables X-Powered-By, adds security headers)
app.use(helmet({
    crossOriginResourcePolicy: false,
}));

// Apply general rate limiter to all requests (100 requests per minute per IP)
app.use(generalLimiter);

// CORS configuration to handle multiple origins
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:5173',
            'https://swinggity.com',
            'https://www.swinggity.com'
        ];
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json()); // allows us to parse incoming requests:req.body
app.use(cookieParser()); // allows us to parse incoming cookies

// CSRF token endpoint used by the SPA before unsafe requests.
app.get('/api/csrf-token', (req, res) => {
    const secret = ensureCsrfSecretCookie(req, res);
    const csrfToken = createCsrfToken(secret);

    res.status(200).json({
        success: true,
        csrfToken,
    });
});

app.use(csrfProtection);

// display a simple message at the root route
app.get('/', (req, res) => {
    res.send('Welcome to the Swinggity community!');
});

// Serve uploaded files (e.g., profile avatars)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// mount the auth routes at the /api/auth path
app.use("/api/auth", authRoutes);

// mount profile routes
app.use('/api/profile', profileRoutes);

// mount member routes
app.use('/api/members', memberRoutes);

// mount jam circle routes
app.use('/api/jam-circle', jamCircleRoutes);

// mount member safety routes
app.use('/api/member-safety', memberSafetyRoutes);

// mount feedback routes
app.use('/api/feedback', feedbackRoutes);

// mount calendar routes for event management
app.use('/api/calendar', calendarRoutes);

// mount organisation routes for organiser pages
app.use('/api/organisation', organisationRoutes);

// start the server
app.listen(PORT, () => {
    // connect to the database when the server starts
    connectDB();
    console.log(`Server is running on port: ${PORT}`);
});