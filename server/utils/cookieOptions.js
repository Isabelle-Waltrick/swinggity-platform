const VALID_SAME_SITE_VALUES = new Set(["strict", "lax", "none"]);

const resolveCookieSameSite = () => {
    const configured = String(process.env.COOKIE_SAME_SITE || "").trim().toLowerCase();
    if (VALID_SAME_SITE_VALUES.has(configured)) {
        return configured;
    }

    // In production, default to "none" so cookies can be sent to API domains
    // hosted separately from the frontend origin.
    return process.env.NODE_ENV === "production" ? "none" : "strict";
};

const resolveCookieSecure = (sameSite) => {
    if (sameSite === "none") {
        return true;
    }

    return process.env.NODE_ENV === "production";
};

const toExpressSameSite = (sameSite) => {
    if (sameSite === "none") return "none";
    if (sameSite === "lax") return "lax";
    return "strict";
};

export const getBaseCookieOptions = () => {
    const sameSite = resolveCookieSameSite();
    return {
        httpOnly: true,
        secure: resolveCookieSecure(sameSite),
        sameSite: toExpressSameSite(sameSite),
        path: "/",
    };
};
