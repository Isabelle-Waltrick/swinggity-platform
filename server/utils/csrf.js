// The code in this file were created with help of AI (Copilot)

import crypto from "crypto";
import { getBaseCookieOptions } from "./cookieOptions.js";

// Cookie key used to store the server-only CSRF secret.
// This secret never leaves the cookie channel and is used to sign short-lived tokens.
const CSRF_SECRET_COOKIE = "csrf_secret";
// CSRF tokens expire after 2 hours to reduce replay risk while staying practical for active sessions.
const CSRF_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

const getCsrfCookieOptions = () => {
    // Reuse the same hardened baseline as auth cookies (httpOnly, secure, sameSite, path)
    // so CSRF secret handling stays consistent across environments.
    const baseCookieOptions = getBaseCookieOptions();
    return {
        httpOnly: baseCookieOptions.httpOnly,
        secure: baseCookieOptions.secure,
        sameSite: baseCookieOptions.sameSite,
        path: baseCookieOptions.path,
        // Keep the secret cookie alive for up to 7 days so users are not forced to refresh
        // CSRF secret state too aggressively between normal sessions.
        maxAge: 7 * 24 * 60 * 60 * 1000,
    };
};

export const ensureCsrfSecretCookie = (req, res) => {
    // If a valid secret already exists in the cookie, preserve it.
    // This avoids rotating secrets on every request and keeps token verification stable.
    const existingSecret = req.cookies?.[CSRF_SECRET_COOKIE];
    if (existingSecret && typeof existingSecret === "string") {
        return existingSecret;
    }

    // Generate 32 random bytes (cryptographically strong) and encode as URL-safe base64.
    // This value becomes the HMAC key used to sign/verify CSRF tokens.
    const nextSecret = crypto.randomBytes(32).toString("base64url");
    res.cookie(CSRF_SECRET_COOKIE, nextSecret, getCsrfCookieOptions());
    return nextSecret;
};

export const clearCsrfSecretCookie = (res) => {
    // Use the same cookie attributes when clearing as when setting.
    // If attributes mismatch, some browsers will not remove the cookie.
    const baseCookieOptions = getBaseCookieOptions();
    res.clearCookie(CSRF_SECRET_COOKIE, {
        httpOnly: baseCookieOptions.httpOnly,
        secure: baseCookieOptions.secure,
        sameSite: baseCookieOptions.sameSite,
        path: baseCookieOptions.path,
    });
};

export const createCsrfToken = (secret) => {
    // Nonce ensures every token is unique, even if generated in the same millisecond.
    const nonce = crypto.randomBytes(16).toString("base64url");
    // Timestamp allows time-based expiry checks without storing server-side token state.
    const issuedAt = Date.now().toString();
    // Signed payload format: nonce.timestamp
    const payload = `${nonce}.${issuedAt}`;
    // HMAC binds token integrity to the secret cookie. Any tampering changes the signature.
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");

    // Final token format: nonce.timestamp.signature
    return `${payload}.${signature}`;
};

export const verifyCsrfToken = (token, secret) => {
    // Basic validation: token and secret must both be present.
    if (!token || !secret || typeof token !== "string") {
        return false;
    }

    // Expected token structure has exactly 3 sections.
    const parts = token.split(".");
    if (parts.length !== 3) {
        return false;
    }

    const [nonce, issuedAt, providedSignature] = parts;
    // Any missing section means malformed token.
    if (!nonce || !issuedAt || !providedSignature) {
        return false;
    }

    // Ensure timestamp is numeric before arithmetic.
    const issuedAtNumber = Number(issuedAt);
    if (!Number.isFinite(issuedAtNumber)) {
        return false;
    }

    // Reject stale tokens to reduce replay window.
    if (Date.now() - issuedAtNumber > CSRF_TOKEN_TTL_MS) {
        return false;
    }

    // Recompute the expected signature from nonce + timestamp using the same secret.
    const payload = `${nonce}.${issuedAt}`;
    const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");

    // Convert to buffers and compare length first.
    // timingSafeEqual throws on length mismatch, so this guard keeps verification safe and predictable.
    const providedBuffer = Buffer.from(providedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }

    // Constant-time comparison mitigates timing attacks against signature checks.
    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};
