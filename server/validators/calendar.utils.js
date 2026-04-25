/**
 * Calendar Utility and Validation Guide
 * This module centralizes parsing, normalization, and validation behavior.
 * It keeps rule logic consistent so controllers do not re-implement checks differently.
 * If input behavior feels surprising, this is often where the answer lives.
 */

import mongoose from "mongoose";
import {
    COUNTRY_TO_CURRENCY,
    DEFAULT_RESALE_VISIBILITY,
    EURO_COUNTRY_CODES,
    RESALE_VISIBILITY_OPTIONS,
} from "../constants/calendar.constants.js";

export const asTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");

export const normalizeMusicFormat = (value) => {
    const musicFormat = asTrimmedString(value);
    if (musicFormat === "All") return "Both";
    return musicFormat;
};

export const isValidObjectIdString = (value) => mongoose.Types.ObjectId.isValid(String(value || "").trim());

export const resolveAbsoluteAssetUrl = (req, rawUrl) => {
    const trimmed = asTrimmedString(rawUrl);
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `${req.protocol}://${req.get("host")}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
};

export const buildCoHostsTextFromContacts = (contacts) => (
    (Array.isArray(contacts) ? contacts : [])
        .map((contact) => asTrimmedString(contact?.displayName))
        .filter(Boolean)
        .join(", ")
        .slice(0, 200)
);

export const buildCoHostContactKey = (contact) => {
    const userId = String(contact?.user || "").trim();
    const entityType = asTrimmedString(contact?.entityType) === "organisation" ? "organisation" : "member";
    const organisationId = String(contact?.organisationId || "").trim();
    return `${userId}|${entityType}|${organisationId}`;
};

export const canUserPublishForOrganisation = (organisation, userId) => {
    const normalizedUserId = String(userId || "").trim();
    if (!organisation || !normalizedUserId) return false;

    const ownerId = String(organisation?.user || "").trim();
    if (ownerId === normalizedUserId) return true;

    const participantContacts = Array.isArray(organisation?.participantContacts)
        ? organisation.participantContacts
        : [];

    return participantContacts.some((entry) => String(entry?.user || "").trim() === normalizedUserId);
};

export const parseRemovedCoHostKeys = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => asTrimmedString(item)).filter(Boolean);
    }

    if (typeof value !== "string") {
        return [];
    }

    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => asTrimmedString(item)).filter(Boolean);
        }
    } catch {
        return [];
    }

    return [];
};

export const parseCoHostSelection = (source = {}) => {
    const coHostUserId = asTrimmedString(source.coHostUserId);
    const coHostType = asTrimmedString(source.coHostType) === "organisation" ? "organisation" : "member";
    const coHostOrganisationId = asTrimmedString(source.coHostOrganisationId);
    const coHostDisplayName = asTrimmedString(source.coHostDisplayName).slice(0, 120);

    if (!coHostUserId) return null;

    return {
        coHostUserId,
        coHostType,
        coHostOrganisationId,
        coHostDisplayName,
    };
};

export const normalizeCurrencyCode = (value) => asTrimmedString(value).toUpperCase();

export const isValidCurrencyCode = (value) => /^[A-Z]{3}$/.test(value);

export const resolveCurrencyFromCountryCode = (countryCode) => {
    const normalized = asTrimmedString(countryCode).toLowerCase();
    if (!normalized) return "";

    const mappedCurrency = COUNTRY_TO_CURRENCY.get(normalized);
    if (mappedCurrency) return mappedCurrency;

    if (EURO_COUNTRY_CODES.has(normalized)) return "EUR";
    return "";
};

export const parseBooleanField = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
    }
    return false;
};

export const parseNumericField = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
};

export const parseGenres = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => asTrimmedString(item)).filter(Boolean);
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => asTrimmedString(item)).filter(Boolean);
            }
        } catch {
            return trimmed
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
        }
    }

    return [];
};

export const parseOptionalUrlField = (value) => {
    const trimmed = asTrimmedString(value);
    if (!trimmed) {
        return {
            isValid: true,
            value: "",
        };
    }

    const prefixed = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, "")}`;
    try {
        const parsed = new URL(prefixed);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return {
                isValid: false,
                value: "",
            };
        }
        return {
            isValid: true,
            value: parsed.toString(),
        };
    } catch {
        return {
            isValid: false,
            value: "",
        };
    }
};

export const inferCityFromAddress = (address) => {
    const normalized = asTrimmedString(address);
    if (!normalized) return "";

    const parts = normalized
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length >= 2) {
        return parts[parts.length - 2].slice(0, 120);
    }

    return parts[0]?.slice(0, 120) || "";
};

export const countWords = (value) => {
    const normalized = asTrimmedString(value);
    if (!normalized) return 0;
    return normalized.split(/\s+/).length;
};

export const escapeHtml = (value) => (
    asTrimmedString(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;")
);

export const validateTime = (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

export const validateDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export const validateQuarterHourTime = (value) => {
    if (!validateTime(value)) return false;
    const [, minutes] = value.split(":");
    return Number(minutes) % 15 === 0;
};

export const parseGeoapifyKeyCandidate = (candidate) => {
    const trimmed = asTrimmedString(candidate);
    if (!trimmed) return "";

    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const parsed = new URL(trimmed);
            return asTrimmedString(parsed.searchParams.get("apiKey"));
        } catch {
            return "";
        }
    }

    return trimmed;
};

export const resolveGeoapifyApiKey = () => {
    const candidates = [
        process.env.GEOAPIFY_API_KEY,
        process.env.GEOAPIFY_KEY,
        process.env.VITE_GEOAPIFY_API_KEY,
        process.env.VITE_GEOAPIFY_KEY,
        process.env.GEOPIFY_API_KEY,
        process.env.GEOPIFY_KEY,
    ];

    for (const candidate of candidates) {
        const resolved = parseGeoapifyKeyCandidate(candidate);
        if (resolved) {
            return resolved;
        }
    }

    return "";
};

export const getIdSet = (value) => new Set(
    (Array.isArray(value) ? value : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
);

export const isResellOpenForEvent = (event) => {
    if (!event || asTrimmedString(event.allowResell) !== "yes") return false;
    if (asTrimmedString(event.resellCondition) === "Always") return true;
    return Boolean(event.resellActivated);
};

export const normalizeResaleVisibility = (value) => {
    const normalized = asTrimmedString(value) || DEFAULT_RESALE_VISIBILITY;
    return RESALE_VISIBILITY_OPTIONS.includes(normalized) ? normalized : DEFAULT_RESALE_VISIBILITY;
};

export const canViewerSeeReseller = ({
    resellerUserId,
    resaleVisibility,
    currentUserId,
    isViewerAdmin,
    isEventOwner,
    viewerCircleSet,
    resellerCircleSet,
}) => {
    const normalizedResellerUserId = String(resellerUserId || "").trim();
    const normalizedCurrentUserId = String(currentUserId || "").trim();

    if (!normalizedResellerUserId) return false;
    if (isViewerAdmin) return true;
    if (isEventOwner) return true;
    if (normalizedResellerUserId === normalizedCurrentUserId) return true;

    const normalizedVisibility = normalizeResaleVisibility(resaleVisibility);
    if (normalizedVisibility === "anyone") return true;

    const viewerSet = viewerCircleSet instanceof Set ? viewerCircleSet : new Set();
    const resellerSet = resellerCircleSet instanceof Set ? resellerCircleSet : new Set();
    const isInResellerCircle = resellerSet.has(normalizedCurrentUserId);

    if (normalizedVisibility === "circle") {
        return isInResellerCircle;
    }

    if (normalizedVisibility === "mutual") {
        if (isInResellerCircle) return true;

        for (const memberId of viewerSet) {
            if (resellerSet.has(memberId)) return true;
        }
    }

    return false;
};

export const normalizeAttendeeAvatar = (value) => asTrimmedString(value).slice(0, 500);

export const buildUserDisplayName = (firstName, lastName, email) => {
    const first = asTrimmedString(firstName);
    const last = asTrimmedString(lastName);
    return `${first} ${last}`.trim() || asTrimmedString(email) || "Swinggity Member";
};
