// The code in this file were created with help of AI (Copilot)

// We only allow official SameSite values so mis-typed env values don't silently weaken cookie policy.
const VALID_SAME_SITE_VALUES = new Set(["strict", "lax", "none"]);

const resolveCookieSameSite = () => {
    // This env var lets us override policy quickly per environment without code edits.
    const configured = String(process.env.COOKIE_SAME_SITE || "").trim().toLowerCase();
    if (VALID_SAME_SITE_VALUES.has(configured)) {
        // If ops explicitly configured a valid value, trust it.
        return configured;
    }

    // Practical default:
    // - production => "none" so cookies still flow when frontend and API are on different domains
    // - local/dev => "strict" to keep the default tighter during development
    return process.env.NODE_ENV === "production" ? "none" : "strict";
};

const resolveCookieSecure = (sameSite) => {
    // Browsers require Secure=true when SameSite=None, so we enforce it here.
    if (sameSite === "none") {
        return true;
    }

    // Outside that special case, we still keep Secure on in production.
    return process.env.NODE_ENV === "production";
};

const normalizeSameSiteForExpress = (sameSite) => {
    // Keep this explicit mapping so behavior is easy to reason about during audits and vivas.
    if (sameSite === "none") return "none";
    if (sameSite === "lax") return "lax";
    return "strict";
};

export const getBaseCookieOptions = () => {
    // Centralized cookie policy: all auth/CSRF cookies can import this to stay consistent.
    const sameSite = resolveCookieSameSite();
    return {
        // httpOnly blocks JavaScript access, reducing XSS token theft risk.
        httpOnly: true,
        // GSR05: secure ensures cookies are only transmitted over HTTPS in production,
        // preventing session tokens from being exposed over plaintext connections.
        secure: resolveCookieSecure(sameSite),
        // sameSite controls whether cookies are sent on cross-site requests.
        sameSite: normalizeSameSiteForExpress(sameSite),
        // path=/ makes cookie available across the whole API surface.
        path: "/",
    };
};
