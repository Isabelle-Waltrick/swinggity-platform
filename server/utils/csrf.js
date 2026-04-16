import crypto from "crypto";

const CSRF_SECRET_COOKIE = "csrf_secret";
const CSRF_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

const getCsrfCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
});

export const ensureCsrfSecretCookie = (req, res) => {
    const existingSecret = req.cookies?.[CSRF_SECRET_COOKIE];
    if (existingSecret && typeof existingSecret === "string") {
        return existingSecret;
    }

    const nextSecret = crypto.randomBytes(32).toString("base64url");
    res.cookie(CSRF_SECRET_COOKIE, nextSecret, getCsrfCookieOptions());
    return nextSecret;
};

export const clearCsrfSecretCookie = (res) => {
    res.clearCookie(CSRF_SECRET_COOKIE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
    });
};

export const createCsrfToken = (secret) => {
    const nonce = crypto.randomBytes(16).toString("base64url");
    const issuedAt = Date.now().toString();
    const payload = `${nonce}.${issuedAt}`;
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");

    return `${payload}.${signature}`;
};

export const verifyCsrfToken = (token, secret) => {
    if (!token || !secret || typeof token !== "string") {
        return false;
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
        return false;
    }

    const [nonce, issuedAt, providedSignature] = parts;
    if (!nonce || !issuedAt || !providedSignature) {
        return false;
    }

    const issuedAtNumber = Number(issuedAt);
    if (!Number.isFinite(issuedAtNumber)) {
        return false;
    }

    if (Date.now() - issuedAtNumber > CSRF_TOKEN_TTL_MS) {
        return false;
    }

    const payload = `${nonce}.${issuedAt}`;
    const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    const providedBuffer = Buffer.from(providedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};
