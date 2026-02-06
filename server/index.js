// importing the express module (had to change "type": "module" in package.json)
import express from 'express';
// importing the dotenv module to manage environment variables
import dotenv from 'dotenv';
// importing the connectDB function from the connectDB.js file
import cookieParser from 'cookie-parser';
import { connectDB } from './db/connectDB.js';
// importing the auth routes from the auth.route.js file
import authRoutes from './routes/auth.route.js';
import cors from 'cors';
// importing the general rate limiter for DoS protection
import { generalLimiter } from './middleware/rateLimiter.js';

// configure dotenv to load variables from .env file
dotenv.config();

// create an express application
const app = express();
// define the port from environment variables or default to 5000
const PORT = process.env.PORT || 5000;

// Trust first proxy (required for rate limiting behind reverse proxies)
app.set('trust proxy', 1);

// Apply general rate limiter to all requests (100 requests per minute per IP)
app.use(generalLimiter);

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173', // frontend URL from env or default
    credentials: true
}));

app.use(express.json()); // allows us to parse incoming requests:req.body
app.use(cookieParser()); // allows us to parse incoming cookies

// display a simple message at the root route
app.get('/', (req, res) => {
    res.send('Welcome to the Swinggity community!');
});

// mount the auth routes at the /api/auth path
app.use("/api/auth", authRoutes);

// start the server
app.listen(PORT, () => {
    // connect to the database when the server starts
    connectDB();
    console.log(`Server is running on port: ${PORT}`);
});
