import { verifyCsrfToken } from "../utils/csrf.js";

const allowedOrigins = new Set([
    "http://localhost:5173",
    "https://swinggity.com",
    "https://www.swinggity.com",
]);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const hasAllowedOrigin = (req) => {
    const origin = req.get("Origin");
    if (origin) {
        return allowedOrigins.has(origin);
    }

    const referer = req.get("Referer");
    if (!referer) {
        return false;
    }

    try {
        return allowedOrigins.has(new URL(referer).origin);
    } catch {
        return false;
    }
};

export const csrfProtection = (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    if (!hasAllowedOrigin(req)) {
        return res.status(403).json({
            success: false,
            message: "CSRF validation failed: invalid origin",
        });
    }

    const csrfSecret = req.cookies?.csrf_secret;
    const csrfToken = req.get("x-csrf-token");
    if (!verifyCsrfToken(csrfToken, csrfSecret)) {
        return res.status(403).json({
            success: false,
            message: "CSRF validation failed: invalid token",
        });
    }

    return next();
};
