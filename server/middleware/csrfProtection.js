// The code in this file were created with help of AI (Copilot)

import { verifyCsrfToken } from "../utils/csrf.js";

// Only these origins are trusted to make state-changing requests with credentials.
const allowedOrigins = new Set([
    "http://localhost:5173",
    "https://swinggity.com",
    "https://www.swinggity.com",
]);

// Safe HTTP methods do not modify server state and are exempt from CSRF token checks.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Validates request source using Origin first, then Referer as a fallback.
// Returns true only when the request can be mapped to one of the trusted origins.
const hasAllowedOrigin = (req) => {
    // Origin header is the most reliable signal for CORS/browser-initiated requests.
    const origin = req.get("Origin");
    if (origin) {
        return allowedOrigins.has(origin);
    }

    // Some clients may omit Origin, so Referer is used as a secondary check.
    const referer = req.get("Referer");
    if (!referer) {
        return false;
    }

    try {
        // Extract just the origin portion from Referer before comparison.
        return allowedOrigins.has(new URL(referer).origin);
    } catch {
        // Malformed Referer values are treated as untrusted.
        return false;
    }
};

/**
 * csrfProtection:
 * Enforces CSRF defenses on non-safe requests by checking both request origin and
 * token validity. This middleware should run after cookie parsing so csrf_secret is
 * available on req.cookies.
 */
export const csrfProtection = (req, res, next) => {
    // Skip CSRF validation for read-only methods.
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    // First line of defense: reject requests from untrusted origins.
    if (!hasAllowedOrigin(req)) {
        return res.status(403).json({
            success: false,
            message: "CSRF validation failed: invalid origin",
        });
    }

    // Second line of defense: compare header token against cookie-backed CSRF secret.
    const csrfSecret = req.cookies?.csrf_secret;
    const csrfToken = req.get("x-csrf-token");
    if (!verifyCsrfToken(csrfToken, csrfSecret)) {
        return res.status(403).json({
            success: false,
            message: "CSRF validation failed: invalid token",
        });
    }

    // Request passed both origin and token checks.
    return next();
};
