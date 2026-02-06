import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for signup endpoint
 * Prevents automated account creation and spam registrations
 * Limits: 5 attempts per IP per 15 minutes
 */
export const signupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 signup attempts per window
    message: {
        success: false,
        message: 'Too many signup attempts. Please try again after 15 minutes.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Removed custom keyGenerator - using default which properly handles IPv6
    handler: (req, res) => {
        console.log(`Rate limit exceeded for signup from IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many signup attempts. Please try again after 15 minutes.'
        });
    }
});

/**
 * Rate limiter for login endpoint
 * Prevents brute force attacks and credential stuffing
 * Limits: 5 attempts per IP per 15 minutes
 */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per window
    message: {
        success: false,
        message: 'Too many login attempts. Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Removed custom keyGenerator - using default which properly handles IPv6
    handler: (req, res) => {
        console.log(`Rate limit exceeded for login from IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many login attempts. Please try again after 15 minutes.'
        });
    }
});

/**
 * Rate limiter for forgot password endpoint
 * Prevents email flooding and enumeration attacks
 * Limits: 3 attempts per IP per 15 minutes (stricter)
 */
export const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // limit each IP to 3 requests per window
    message: {
        success: false,
        message: 'Too many password reset requests. Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Removed custom keyGenerator - using default which properly handles IPv6
    handler: (req, res) => {
        console.log(`Rate limit exceeded for forgot-password from IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many password reset requests. Please try again after 15 minutes.'
        });
    }
});

/**
 * Rate limiter for reset password endpoint
 * Prevents brute force token guessing
 * Limits: 5 attempts per IP per 15 minutes
 */
export const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 attempts per window
    message: {
        success: false,
        message: 'Too many password reset attempts. Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Removed custom keyGenerator - using default which properly handles IPv6
    handler: (req, res) => {
        console.log(`Rate limit exceeded for reset-password from IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many password reset attempts. Please try again after 15 minutes.'
        });
    }
});

/**
 * Rate limiter for email verification endpoint
 * Prevents brute force verification code guessing
 * Limits: 5 attempts per IP per 15 minutes
 */
export const verifyEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 attempts per window
    message: {
        success: false,
        message: 'Too many verification attempts. Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Removed custom keyGenerator - using default which properly handles IPv6
    handler: (req, res) => {
        console.log(`Rate limit exceeded for verify-email from IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many verification attempts. Please try again after 15 minutes.'
        });
    }
});

/**
 * General rate limiter for all API requests
 * Prevents DoS attacks and excessive API usage
 * Limits: 100 requests per IP per minute
 */
export const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per window
    message: {
        success: false,
        message: 'Too many requests. Please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Removed custom keyGenerator - using default which properly handles IPv6
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/';
    }
});