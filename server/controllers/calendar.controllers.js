import { CalendarEvent } from "../models/calendarEvent.model.js";
import { User } from "../models/user.model.js";
import { Profile } from "../models/profile.model.js";
import { Organisation } from "../models/organisation.model.js";
import fs from "fs/promises";
import crypto from "crypto";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import { sendCoHostInviteEmail, sendOrganiserVerificationRequestEmail } from "../mailtrap/emails.js";

const EVENT_TYPES = ["Social", "Class", "Workshop", "Festival"];
const MUSIC_FORMATS = ["All", "DJ", "Live music"];
const TICKET_TYPES = ["prepaid", "door"];
const RESALE_OPTIONS = ["When tickets are sold-out", "Always"];
const RESALE_TICKETS_MAX = 10;
const ALLOWED_ROLES = ["organiser", "organizer", "admin"];
const CONTACT_MESSAGE_MAX_WORDS = 200;
const COHOST_INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const EVENT_DESCRIPTION_MAX_LENGTH = 2000;
const GEOAPIFY_AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete";
const GEOAPIFY_REVERSE_URL = "https://api.geoapify.com/v1/geocode/reverse";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || "";
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || "";
const isCloudinaryConfigured = Boolean(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret);

if (isCloudinaryConfigured) {
    cloudinary.config({
        cloud_name: cloudinaryCloudName,
        api_key: cloudinaryApiKey,
        api_secret: cloudinaryApiSecret,
        secure: true,
    });
}

const getEventCloudPublicId = (userId) => `event-${String(userId || "unknown")}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

const uploadEventImageToCloudinary = async ({ fileBuffer, mimeType, userId }) => {
    if (!isCloudinaryConfigured) {
        throw new Error("Cloudinary is not configured");
    }

    const publicId = getEventCloudPublicId(userId);
    const payload = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                public_id: publicId,
                resource_type: "image",
                overwrite: true,
                invalidate: true,
                folder: "swinggity/events",
                format: (mimeType || "").includes("png") ? "png" : undefined,
            },
            (error, result) => {
                if (error || !result) {
                    reject(error || new Error("Cloud event image upload failed"));
                    return;
                }
                resolve(result);
            }
        );

        uploadStream.end(fileBuffer);
    });

    return {
        imageUrl: payload.secure_url,
        imageStorageId: payload.public_id,
    };
};

const deleteCloudinaryEventImage = async (imageStorageId) => {
    if (!isCloudinaryConfigured || !imageStorageId) return;

    await cloudinary.uploader.destroy(imageStorageId, {
        resource_type: "image",
        invalidate: true,
    }).catch(() => undefined);
};

const deleteEventImageFileIfLocal = async (imageUrl) => {
    if (!imageUrl || !imageUrl.startsWith("/uploads/events/")) return;

    const absoluteImagePath = path.join(__dirname, "..", imageUrl.replace(/^\//, "").replace(/\//g, path.sep));
    await fs.unlink(absoluteImagePath).catch(() => undefined);
};

const deleteEventImageAsset = async ({ imageUrl, imageStorageId }) => {
    if (imageStorageId) {
        await deleteCloudinaryEventImage(imageStorageId);
        return;
    }

    await deleteEventImageFileIfLocal(imageUrl);
};

const storeEventImageAsset = async ({ file, userId }) => {
    if (!file) {
        return { imageUrl: "", imageStorageId: "" };
    }

    if (isCloudinaryConfigured) {
        if (!file.buffer) {
            throw new Error("Event image buffer is missing");
        }
        return uploadEventImageToCloudinary({
            fileBuffer: file.buffer,
            mimeType: file.mimetype,
            userId,
        });
    }

    return {
        imageUrl: file.filename ? `/uploads/events/${file.filename}` : "",
        imageStorageId: "",
    };
};

const EURO_COUNTRY_CODES = new Set([
    "ad", "at", "be", "cy", "de", "ee", "es", "fi", "fr", "gr", "hr", "ie", "it", "lt", "lu", "lv", "mc", "mt", "nl", "pt", "si", "sk", "sm", "va",
]);
const COUNTRY_TO_CURRENCY = new Map([
    ["ae", "AED"], ["af", "AFN"], ["al", "ALL"], ["am", "AMD"], ["ao", "AOA"], ["ar", "ARS"], ["au", "AUD"], ["aw", "AWG"],
    ["az", "AZN"], ["ba", "BAM"], ["bb", "BBD"], ["bd", "BDT"], ["bg", "BGN"], ["bh", "BHD"], ["bi", "BIF"], ["bm", "BMD"],
    ["bn", "BND"], ["bo", "BOB"], ["br", "BRL"], ["bs", "BSD"], ["bt", "BTN"], ["bw", "BWP"], ["by", "BYN"], ["bz", "BZD"],
    ["ca", "CAD"], ["cd", "CDF"], ["ch", "CHF"], ["cl", "CLP"], ["cn", "CNY"], ["co", "COP"], ["cr", "CRC"], ["cu", "CUP"],
    ["cv", "CVE"], ["cz", "CZK"], ["dj", "DJF"], ["dk", "DKK"], ["do", "DOP"], ["dz", "DZD"], ["eg", "EGP"], ["er", "ERN"],
    ["et", "ETB"], ["fj", "FJD"], ["fk", "FKP"], ["gb", "GBP"], ["ge", "GEL"], ["gh", "GHS"], ["gi", "GIP"], ["gm", "GMD"],
    ["gn", "GNF"], ["gt", "GTQ"], ["gy", "GYD"], ["hk", "HKD"], ["hn", "HNL"], ["ht", "HTG"], ["hu", "HUF"], ["id", "IDR"],
    ["il", "ILS"], ["in", "INR"], ["iq", "IQD"], ["ir", "IRR"], ["is", "ISK"], ["jm", "JMD"], ["jo", "JOD"], ["jp", "JPY"],
    ["ke", "KES"], ["kg", "KGS"], ["kh", "KHR"], ["km", "KMF"], ["kp", "KPW"], ["kr", "KRW"], ["kw", "KWD"], ["ky", "KYD"],
    ["kz", "KZT"], ["la", "LAK"], ["lb", "LBP"], ["lk", "LKR"], ["lr", "LRD"], ["ly", "LYD"], ["ma", "MAD"], ["md", "MDL"],
    ["mg", "MGA"], ["mk", "MKD"], ["mm", "MMK"], ["mn", "MNT"], ["mo", "MOP"], ["mr", "MRU"], ["mu", "MUR"], ["mv", "MVR"],
    ["mw", "MWK"], ["mx", "MXN"], ["my", "MYR"], ["mz", "MZN"], ["na", "NAD"], ["ng", "NGN"], ["ni", "NIO"], ["no", "NOK"],
    ["np", "NPR"], ["nz", "NZD"], ["om", "OMR"], ["pa", "PAB"], ["pe", "PEN"], ["pg", "PGK"], ["ph", "PHP"], ["pk", "PKR"],
    ["pl", "PLN"], ["py", "PYG"], ["qa", "QAR"], ["ro", "RON"], ["rs", "RSD"], ["ru", "RUB"], ["rw", "RWF"], ["sa", "SAR"],
    ["sb", "SBD"], ["sc", "SCR"], ["sd", "SDG"], ["se", "SEK"], ["sg", "SGD"], ["sh", "SHP"], ["sl", "SLE"], ["so", "SOS"],
    ["sr", "SRD"], ["ss", "SSP"], ["st", "STN"], ["sz", "SZL"], ["th", "THB"], ["tj", "TJS"], ["tm", "TMT"], ["tn", "TND"],
    ["to", "TOP"], ["tr", "TRY"], ["tt", "TTD"], ["tw", "TWD"], ["tz", "TZS"], ["ua", "UAH"], ["ug", "UGX"], ["us", "USD"],
    ["uy", "UYU"], ["uz", "UZS"], ["ve", "VES"], ["vn", "VND"], ["vu", "VUV"], ["ws", "WST"], ["ye", "YER"], ["za", "ZAR"],
    ["zm", "ZMW"], ["zw", "USD"],

    // Shared/union currency areas.
    ["ag", "XCD"], ["ai", "XCD"], ["dm", "XCD"], ["gd", "XCD"], ["kn", "XCD"], ["lc", "XCD"], ["ms", "XCD"], ["vc", "XCD"],
    ["bj", "XOF"], ["bf", "XOF"], ["ci", "XOF"], ["gw", "XOF"], ["ml", "XOF"], ["ne", "XOF"], ["sn", "XOF"], ["tg", "XOF"],
    ["cm", "XAF"], ["cf", "XAF"], ["cg", "XAF"], ["ga", "XAF"], ["gq", "XAF"], ["td", "XAF"],
    ["nc", "XPF"], ["pf", "XPF"], ["wf", "XPF"],
    ["ec", "USD"], ["sv", "USD"], ["fm", "USD"], ["mh", "USD"], ["pw", "USD"], ["pr", "USD"], ["vi", "USD"],
    ["gg", "GBP"], ["im", "GBP"], ["je", "GBP"],
]);

const parseGeoapifyKeyCandidate = (candidate) => {
    const trimmed = asTrimmedString(candidate);
    if (!trimmed) return "";

    // Support full URL values by extracting apiKey=... from query string.
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

const resolveGeoapifyApiKey = () => {
    // Accept common names used in different deployment platforms.
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

const asTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");

const isValidObjectIdString = (value) => mongoose.Types.ObjectId.isValid(String(value || "").trim());

const resolveAbsoluteAssetUrl = (req, rawUrl) => {
    const trimmed = asTrimmedString(rawUrl);
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `${req.protocol}://${req.get("host")}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
};

const buildCoHostsTextFromContacts = (contacts) => {
    return (Array.isArray(contacts) ? contacts : [])
        .map((contact) => asTrimmedString(contact?.displayName))
        .filter(Boolean)
        .join(", ")
        .slice(0, 200);
};

const buildCoHostContactKey = (contact) => {
    const userId = String(contact?.user || "").trim();
    const entityType = asTrimmedString(contact?.entityType) === "organisation" ? "organisation" : "member";
    const organisationId = String(contact?.organisationId || "").trim();
    return `${userId}|${entityType}|${organisationId}`;
};

const canUserPublishForOrganisation = (organisation, userId) => {
    const normalizedUserId = String(userId || "").trim();
    if (!organisation || !normalizedUserId) return false;

    const ownerId = String(organisation?.user || "").trim();
    if (ownerId === normalizedUserId) return true;

    const participantContacts = Array.isArray(organisation?.participantContacts)
        ? organisation.participantContacts
        : [];

    return participantContacts.some((entry) => String(entry?.user || "").trim() === normalizedUserId);
};

const parseRemovedCoHostKeys = (value) => {
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

const parseCoHostSelection = (source = {}) => {
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

const normalizeCurrencyCode = (value) => asTrimmedString(value).toUpperCase();

const isValidCurrencyCode = (value) => /^[A-Z]{3}$/.test(value);

const resolveCurrencyFromCountryCode = (countryCode) => {
    const normalized = asTrimmedString(countryCode).toLowerCase();
    if (!normalized) return "";

    const mappedCurrency = COUNTRY_TO_CURRENCY.get(normalized);
    if (mappedCurrency) return mappedCurrency;

    if (EURO_COUNTRY_CODES.has(normalized)) return "EUR";
    return "";
};

const parseBooleanField = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
    }
    return false;
};

const parseNumericField = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
};

const parseGenres = (value) => {
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

const parseOptionalUrlField = (value) => {
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

const inferCityFromAddress = (address) => {
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

const countWords = (value) => {
    const normalized = asTrimmedString(value);
    if (!normalized) return 0;
    return normalized.split(/\s+/).length;
};

const escapeHtml = (value) => (
    asTrimmedString(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;")
);

const validateTime = (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
const validateDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};
const validateQuarterHourTime = (value) => {
    if (!validateTime(value)) return false;
    const [, minutes] = value.split(":");
    return Number(minutes) % 15 === 0;
};

const buildActivityLine = (title, startDate, startTime) => {
    const date = asTrimmedString(startDate);
    const time = asTrimmedString(startTime);
    return `Created event: ${title} (${date} ${time})`;
};

const findUserOrReject = async (userId, res) => {
    const user = await User.findById(userId);
    if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return null;
    }
    return user;
};

const ensureEventPosterRole = (user, res) => {
    if (!ALLOWED_ROLES.includes(user.role)) {
        res.status(403).json({
            success: false,
            message: "Only users with organiser or admin role can create or manage events",
        });
        return false;
    }
    return true;
};

const isAdminRole = (role) => asTrimmedString(role) === "admin";

const canManageEvent = (user, event) => {
    if (!user || !event) return false;
    const createdById = String(event?.createdBy?._id || event?.createdBy || "");
    const isOwner = createdById === String(user._id || "");
    return isOwner;
};

const isResellOpenForEvent = (event) => {
    if (!event || asTrimmedString(event.allowResell) !== "yes") return false;
    if (asTrimmedString(event.resellCondition) === "Always") return true;
    return Boolean(event.resellActivated);
};

const normalizeAttendeeAvatar = (value) => asTrimmedString(value).slice(0, 500);

const buildUserDisplayName = (firstName, lastName, email) => {
    const first = asTrimmedString(firstName);
    const last = asTrimmedString(lastName);
    return `${first} ${last}`.trim() || asTrimmedString(email) || "Swinggity Member";
};

const normalizeLegacyActivity = (activityText) => {
    const activity = asTrimmedString(activityText);
    if (!activity) return [];

    return activity
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 10)
        .map((line) => ({
            type: "legacy",
            entityType: "",
            entityId: null,
            message: line.slice(0, 220),
            createdAt: new Date(),
        }));
};

const upsertProfileActivity = async (user, activityItem) => {
    const existingProfile = await Profile.findOne({ user: user._id });
    const normalizedActivityItem = {
        type: asTrimmedString(activityItem.type) || "event.activity",
        entityType: asTrimmedString(activityItem.entityType),
        entityId: activityItem.entityId && mongoose.Types.ObjectId.isValid(String(activityItem.entityId))
            ? activityItem.entityId
            : null,
        message: asTrimmedString(activityItem.message).slice(0, 220),
        createdAt: activityItem.createdAt instanceof Date ? activityItem.createdAt : new Date(),
    };

    const existingFeed = Array.isArray(existingProfile?.activityFeed)
        ? existingProfile.activityFeed
        : normalizeLegacyActivity(existingProfile?.activity);

    const nextFeed = [normalizedActivityItem, ...existingFeed].slice(0, 30);
    const legacyActivityText = nextFeed
        .map((item) => asTrimmedString(item?.message))
        .filter(Boolean)
        .join("\n")
        .slice(0, 1000);

    if (existingProfile) {
        existingProfile.activityFeed = nextFeed;
        existingProfile.activity = legacyActivityText;
        await existingProfile.save();
        return;
    }

    await Profile.create({
        user: user._id,
        displayFirstName: user.firstName,
        displayLastName: user.lastName,
        activity: legacyActivityText,
        activityFeed: nextFeed,
    });
};

const removeEventActivityFromProfile = async (userId, eventId) => {
    const profile = await Profile.findOne({ user: userId });
    if (!profile) return;

    const currentFeed = Array.isArray(profile.activityFeed)
        ? profile.activityFeed
        : normalizeLegacyActivity(profile.activity);
    const nextFeed = currentFeed
        .filter((item) => !(
            asTrimmedString(item?.entityType) === "event"
            && String(item?.entityId || "") === String(eventId || "")
        ))
        .slice(0, 30);

    profile.activityFeed = nextFeed;
    profile.activity = nextFeed
        .map((item) => asTrimmedString(item?.message))
        .filter(Boolean)
        .join("\n")
        .slice(0, 1000);

    await profile.save();
};

const getProfileAvatarByUserId = async (userId) => {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId || !mongoose.Types.ObjectId.isValid(normalizedUserId)) return "";

    const profile = await Profile.findOne({ user: normalizedUserId }).select("avatarUrl").lean();
    return normalizeAttendeeAvatar(profile?.avatarUrl);
};

const getProfileDisplayNameByUserId = async (userId) => {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId || !mongoose.Types.ObjectId.isValid(normalizedUserId)) return "";

    const profile = await Profile.findOne({ user: normalizedUserId })
        .select("displayFirstName displayLastName")
        .lean();

    return buildUserDisplayName(profile?.displayFirstName, profile?.displayLastName, "");
};

const getProfileAvatarMapByUserIds = async (userIds) => {
    const normalizedUserIds = [...new Set(
        (Array.isArray(userIds) ? userIds : [])
            .map((userId) => String(userId || "").trim())
            .filter((userId) => userId && mongoose.Types.ObjectId.isValid(userId))
    )];

    if (normalizedUserIds.length === 0) return {};

    const profiles = await Profile.find({ user: { $in: normalizedUserIds } })
        .select("user avatarUrl")
        .lean();

    return profiles.reduce((accumulator, profile) => {
        const ownerId = String(profile?.user || "").trim();
        if (!ownerId) return accumulator;
        accumulator[ownerId] = normalizeAttendeeAvatar(profile?.avatarUrl);
        return accumulator;
    }, {});
};

const getProfileDisplayNameMapByUserIds = async (userIds) => {
    const normalizedUserIds = [...new Set(
        (Array.isArray(userIds) ? userIds : [])
            .map((userId) => String(userId || "").trim())
            .filter((userId) => userId && mongoose.Types.ObjectId.isValid(userId))
    )];

    if (normalizedUserIds.length === 0) return {};

    const profiles = await Profile.find({ user: { $in: normalizedUserIds } })
        .select("user displayFirstName displayLastName")
        .lean();

    return profiles.reduce((accumulator, profile) => {
        const ownerId = String(profile?.user || "").trim();
        if (!ownerId) return accumulator;
        accumulator[ownerId] = buildUserDisplayName(profile?.displayFirstName, profile?.displayLastName, "");
        return accumulator;
    }, {});
};

const getOrganisationSummaryMapByIds = async (organisationIds) => {
    const normalizedOrganisationIds = [...new Set(
        (Array.isArray(organisationIds) ? organisationIds : [])
            .map((organisationId) => String(organisationId || "").trim())
            .filter((organisationId) => organisationId && mongoose.Types.ObjectId.isValid(organisationId))
    )];

    if (normalizedOrganisationIds.length === 0) return {};

    const organisations = await Organisation.find({ _id: { $in: normalizedOrganisationIds } })
        .select("_id organisationName imageUrl")
        .lean();

    return organisations.reduce((accumulator, organisation) => {
        const id = String(organisation?._id || "").trim();
        if (!id) return accumulator;

        accumulator[id] = {
            organisationName: asTrimmedString(organisation?.organisationName),
            imageUrl: asTrimmedString(organisation?.imageUrl),
        };

        return accumulator;
    }, {});
};

const appendCoHostInvitation = async ({ req, event, requesterUser, selectedCoHost }) => {
    if (!selectedCoHost) return;

    const requesterUserId = String(requesterUser?._id || "");
    const requesterProfile = await Profile.findOne({ user: requesterUserId }).lean();
    const requesterName = buildUserDisplayName(
        requesterProfile?.displayFirstName || requesterUser?.firstName,
        requesterProfile?.displayLastName || requesterUser?.lastName,
        requesterUser?.email
    );
    const requesterAvatarRelative = asTrimmedString(requesterProfile?.avatarUrl);
    const requesterAvatarAbsolute = resolveAbsoluteAssetUrl(req, requesterAvatarRelative);
    const fallbackAvatar = "https://ui-avatars.com/api/?name=Swinggity+Member&background=FF6699&color=ffffff&size=256";

    let inviteeUserId = selectedCoHost.coHostUserId;
    let organisationId = null;
    let contactDisplayName = selectedCoHost.coHostDisplayName || "";

    if (!isValidObjectIdString(inviteeUserId)) {
        throw new Error("Selected co-host is invalid");
    }

    if (selectedCoHost.coHostType === "organisation") {
        const organisationIdCandidate = selectedCoHost.coHostOrganisationId || selectedCoHost.coHostUserId;
        if (!isValidObjectIdString(organisationIdCandidate)) {
            throw new Error("Selected organisation is invalid");
        }

        const organisation = await Organisation.findById(organisationIdCandidate).lean();
        if (!organisation || !isValidObjectIdString(organisation.user)) {
            throw new Error("Organisation owner was not found");
        }

        inviteeUserId = String(organisation.user);
        organisationId = organisation._id;
        if (!contactDisplayName) {
            contactDisplayName = asTrimmedString(organisation.organisationName) || "Swinggity Organisation";
        }
    }

    if (String(inviteeUserId) === requesterUserId) {
        throw new Error("You cannot add yourself as a co-host");
    }

    const [inviteeUser, inviteeProfileRaw] = await Promise.all([
        User.findById(inviteeUserId),
        Profile.findOne({ user: inviteeUserId }),
    ]);

    if (!inviteeUser) {
        throw new Error("Selected co-host is no longer available");
    }

    const inviteeProfile = inviteeProfileRaw || await Profile.create({
        user: inviteeUserId,
        displayFirstName: inviteeUser.firstName,
        displayLastName: inviteeUser.lastName,
    });

    if (!contactDisplayName) {
        contactDisplayName = buildUserDisplayName(
            inviteeProfile?.displayFirstName || inviteeUser.firstName,
            inviteeProfile?.displayLastName || inviteeUser.lastName,
            inviteeUser.email
        );
    }

    const pendingInvites = Array.isArray(inviteeProfile.pendingCoHostInvitations)
        ? inviteeProfile.pendingCoHostInvitations
        : [];
    const hasActiveInvite = pendingInvites.some((invite) => {
        if (String(invite?.eventId || "") !== String(event._id || "")) return false;
        if (String(invite?.invitedBy || "") !== requesterUserId) return false;
        const expiresAt = invite?.expiresAt ? new Date(invite.expiresAt).getTime() : 0;
        return expiresAt > Date.now();
    });

    if (hasActiveInvite) {
        return;
    }

    const invitationToken = crypto.randomBytes(32).toString("hex");
    const invitationTokenHash = crypto.createHash("sha256").update(invitationToken).digest("hex");
    const expiresAt = new Date(Date.now() + COHOST_INVITATION_EXPIRY_MS);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const encodedToken = encodeURIComponent(invitationToken);
    const acceptUrl = `${baseUrl}/api/calendar/cohost-invitations/respond?token=${encodedToken}&action=accept`;
    const denyUrl = `${baseUrl}/api/calendar/cohost-invitations/respond?token=${encodedToken}&action=deny`;

    inviteeProfile.pendingCoHostInvitations = [
        ...pendingInvites,
        {
            tokenHash: invitationTokenHash,
            eventId: event._id,
            eventTitle: asTrimmedString(event.title).slice(0, 120),
            invitedBy: requesterUser._id,
            invitedByName: requesterName,
            invitedByAvatarUrl: requesterAvatarRelative,
            contactType: selectedCoHost.coHostType,
            contactDisplayName,
            organisationId,
            invitedAt: new Date(),
            expiresAt,
        },
    ];
    await inviteeProfile.save();

    await sendCoHostInviteEmail({
        recipientEmail: inviteeUser.email,
        inviterName: requesterName,
        inviterAvatarUrl: requesterAvatarAbsolute || fallbackAvatar,
        eventTitle: asTrimmedString(event.title).slice(0, 120) || "your event",
        coHostDisplayName: selectedCoHost.coHostType === "organisation" ? contactDisplayName : "you",
        acceptUrl,
        denyUrl,
    });
};

const applyAcceptedCoHostToEvent = async (inviteeProfile, invitation) => {
    const event = await CalendarEvent.findById(invitation.eventId);
    if (!event) return;

    const isOrganisationContact = invitation.contactType === "organisation";
    let contactDisplayName = asTrimmedString(invitation.contactDisplayName);
    let contactAvatarUrl = asTrimmedString(inviteeProfile.avatarUrl);
    let organisationId = null;

    if (isOrganisationContact && isValidObjectIdString(invitation.organisationId)) {
        const organisation = await Organisation.findById(invitation.organisationId).lean();
        if (organisation) {
            organisationId = organisation._id;
            contactDisplayName = contactDisplayName
                || asTrimmedString(organisation.organisationName)
                || "Swinggity Organisation";
            contactAvatarUrl = asTrimmedString(organisation.imageUrl);
        }
    }

    const contactEntry = {
        user: inviteeProfile.user,
        entityType: isOrganisationContact ? "organisation" : "member",
        organisationId: isOrganisationContact ? organisationId : null,
        displayName: contactDisplayName,
        avatarUrl: contactAvatarUrl,
    };

    const existingContacts = Array.isArray(event.coHostContacts) ? event.coHostContacts : [];
    const filteredContacts = existingContacts.filter((contact) => {
        const sameUser = String(contact?.user || "") === String(contactEntry.user || "");
        const sameOrg = String(contact?.organisationId || "") === String(contactEntry.organisationId || "");
        const sameType = asTrimmedString(contact?.entityType) === asTrimmedString(contactEntry.entityType);
        return !(sameUser && sameOrg && sameType);
    });

    event.coHostContacts = [...filteredContacts, contactEntry].slice(0, 10);
    event.coHosts = buildCoHostsTextFromContacts(event.coHostContacts);
    await event.save();
};

const appendCoHostResponseNotification = async ({ invitation, inviteeProfile, action }) => {
    if (!invitation || (action !== "accept" && action !== "deny")) return;

    const inviterUserId = String(invitation?.invitedBy || "").trim();
    if (!isValidObjectIdString(inviterUserId)) return;

    const inviteeUserId = String(inviteeProfile?.user || "").trim();
    if (!isValidObjectIdString(inviteeUserId)) return;

    const inviteeName = asTrimmedString(invitation?.contactDisplayName)
        || buildUserDisplayName(inviteeProfile?.displayFirstName, inviteeProfile?.displayLastName, "")
        || "Swinggity Member";

    const isOrganisationContact = asTrimmedString(invitation?.contactType) === "organisation";
    let inviteeAvatarUrl = asTrimmedString(inviteeProfile?.avatarUrl);

    if (isOrganisationContact && isValidObjectIdString(invitation?.organisationId)) {
        const organisation = await Organisation.findById(invitation.organisationId).select("imageUrl").lean();
        inviteeAvatarUrl = asTrimmedString(organisation?.imageUrl) || inviteeAvatarUrl;
    }

    const responseItem = {
        eventId: invitation.eventId,
        eventTitle: asTrimmedString(invitation?.eventTitle).slice(0, 120),
        inviteeUser: inviteeProfile.user,
        inviteeName,
        inviteeAvatarUrl,
        response: action,
        respondedAt: new Date(),
    };

    const inviterProfile = await Profile.findOne({ user: inviterUserId });
    if (inviterProfile) {
        const existingResponses = Array.isArray(inviterProfile.coHostInvitationResponses)
            ? inviterProfile.coHostInvitationResponses
            : [];
        inviterProfile.coHostInvitationResponses = [responseItem, ...existingResponses].slice(0, 30);
        await inviterProfile.save();
        return;
    }

    await Profile.create({
        user: inviterUserId,
        coHostInvitationResponses: [responseItem],
    });
};

const toClientEvent = (eventDoc, currentUserId, options = {}) => {
    const host = eventDoc?.createdBy;
    const firstName = asTrimmedString(host?.firstName);
    const lastName = asTrimmedString(host?.lastName);
    const fallbackOrganizerName = asTrimmedString(options?.organizerDisplayName) || `${firstName} ${lastName}`.trim() || host?.email || "Swinggity Host";
    const publisherType = asTrimmedString(eventDoc?.publisherType) === "organisation" ? "organisation" : "member";
    const publisherOrganisationId = String(eventDoc?.publisherOrganisationId || "").trim();
    const publisherOrganisationMap = options?.publisherOrganisationMap && typeof options.publisherOrganisationMap === "object"
        ? options.publisherOrganisationMap
        : {};
    const publisherOrganisationSummary = publisherType === "organisation" && publisherOrganisationId
        ? publisherOrganisationMap[publisherOrganisationId]
        : null;
    const organizerName = publisherType === "organisation"
        ? asTrimmedString(publisherOrganisationSummary?.organisationName) || fallbackOrganizerName
        : fallbackOrganizerName;
    const createdById = String(host?._id || eventDoc?.createdBy || "");
    const createdByName = fallbackOrganizerName;
    const createdByAvatarUrl = normalizeAttendeeAvatar(options?.organizerAvatarUrl);
    const organizerAvatarUrl = publisherType === "organisation"
        ? normalizeAttendeeAvatar(publisherOrganisationSummary?.imageUrl) || normalizeAttendeeAvatar(options?.organizerAvatarUrl)
        : normalizeAttendeeAvatar(options?.organizerAvatarUrl);
    const attendeeDisplayNameMap = options?.attendeeDisplayNameMap && typeof options.attendeeDisplayNameMap === "object"
        ? options.attendeeDisplayNameMap
        : {};
    const coHostOrganisationMap = options?.coHostOrganisationMap && typeof options.coHostOrganisationMap === "object"
        ? options.coHostOrganisationMap
        : {};
    const attendees = Array.isArray(eventDoc?.attendees)
        ? eventDoc.attendees
            .map((attendee) => {
                const attendeeUserId = String(attendee?.user?._id || attendee?.user || "");
                const attendeeDisplayName = asTrimmedString(attendeeDisplayNameMap[attendeeUserId])
                    || buildUserDisplayName(attendee?.user?.firstName, attendee?.user?.lastName, attendee?.user?.email);

                return {
                    userId: attendeeUserId,
                    avatarUrl: normalizeAttendeeAvatar(attendee?.avatarUrl),
                    displayName: attendeeDisplayName,
                    resaleTicketCount: Number.isFinite(attendee?.resaleTicketCount) ? attendee.resaleTicketCount : 0,
                };
            })
            .filter((attendee) => attendee.userId)
        : [];
    const normalizedCurrentUserId = String(currentUserId || "");

    return {
        id: String(eventDoc?._id || ""),
        createdById,
        eventType: eventDoc?.eventType || "Social",
        title: eventDoc?.title || "",
        description: eventDoc?.description || "",
        genres: Array.isArray(eventDoc?.genres) ? eventDoc.genres : [],
        musicFormat: eventDoc?.musicFormat || "All",
        startDate: eventDoc?.startDate || "",
        startTime: eventDoc?.startTime || "",
        endDate: eventDoc?.endDate || "",
        endTime: eventDoc?.endTime || "",
        venue: eventDoc?.venue || "",
        address: eventDoc?.address || "",
        city: eventDoc?.city || "",
        onlineEvent: Boolean(eventDoc?.onlineEvent),
        ticketType: eventDoc?.ticketType || "prepaid",
        freeEvent: Boolean(eventDoc?.freeEvent),
        minPrice: Number.isFinite(eventDoc?.minPrice) ? eventDoc.minPrice : 0,
        maxPrice: Number.isFinite(eventDoc?.maxPrice) ? eventDoc.maxPrice : 0,
        fixedPrice: Boolean(eventDoc?.fixedPrice),
        currency: eventDoc?.currency || "GBP",
        ticketLink: eventDoc?.ticketLink || "",
        allowResell: eventDoc?.allowResell || "no",
        resellCondition: eventDoc?.resellCondition || "When tickets are sold-out",
        resellActivated: Boolean(eventDoc?.resellActivated),
        canUsersResell: isResellOpenForEvent(eventDoc),
        onlineLinks: eventDoc?.onlineLinks || {
            instagram: "",
            facebook: "",
            youtube: "",
            linkedin: "",
            website: "",
        },
        coHosts: eventDoc?.coHosts || "",
        coHostContacts: Array.isArray(eventDoc?.coHostContacts)
            ? eventDoc.coHostContacts.map((contact) => {
                const entityType = asTrimmedString(contact?.entityType) === "organisation" ? "organisation" : "member";
                const organisationId = contact?.organisationId ? String(contact.organisationId) : "";
                const organisationSummary = entityType === "organisation" ? coHostOrganisationMap[organisationId] : null;
                const displayName = asTrimmedString(organisationSummary?.organisationName)
                    || asTrimmedString(contact?.displayName);
                const avatarUrl = asTrimmedString(organisationSummary?.imageUrl)
                    || asTrimmedString(contact?.avatarUrl);

                return {
                    user: String(contact?.user || ""),
                    entityType,
                    organisationId,
                    profileId: entityType === "organisation" && organisationId
                        ? organisationId
                        : String(contact?.user || ""),
                    displayName,
                    avatarUrl,
                };
            })
            : [],
        imageUrl: eventDoc?.imageUrl || "",
        publisherType,
        publisherOrganisationId,
        createdByName,
        createdByAvatarUrl,
        organizerName,
        organizerAvatarUrl,
        attendees,
        attendeesCount: attendees.length,
        isGoing: normalizedCurrentUserId ? attendees.some((attendee) => attendee.userId === normalizedCurrentUserId) : false,
        canEdit: String(currentUserId || "") === createdById,
        createdAt: eventDoc?.createdAt,
        updatedAt: eventDoc?.updatedAt,
    };
};

export const createCalendarEvent = async (req, res) => {
    let uploadedImageAsset = null;
    let eventCreated = false;
    try {
        const userId = req.userId;
        const user = await findUserOrReject(userId, res);
        if (!user) return;
        if (!ensureEventPosterRole(user, res)) return;

        const eventType = asTrimmedString(req.body.eventType) || "Social";
        const title = asTrimmedString(req.body.title);
        const description = asTrimmedString(req.body.description);
        const genres = parseGenres(req.body.genres);
        const musicFormat = asTrimmedString(req.body.musicFormat) || "All";
        const startDate = asTrimmedString(req.body.startDate);
        const startTime = asTrimmedString(req.body.startTime);
        const endDateInput = asTrimmedString(req.body.endDate);
        const endTime = asTrimmedString(req.body.endTime);
        const hasEndDateTime = Boolean(endDateInput || endTime);
        const endDate = hasEndDateTime ? (endDateInput || startDate) : "";
        const venue = asTrimmedString(req.body.venue);
        const address = asTrimmedString(req.body.address);
        const cityInput = asTrimmedString(req.body.city);
        const city = (cityInput || inferCityFromAddress(address)).slice(0, 120);
        const onlineEvent = parseBooleanField(req.body.onlineEvent);
        const ticketType = asTrimmedString(req.body.ticketType) || "prepaid";
        const freeEvent = parseBooleanField(req.body.freeEvent);
        const fixedPrice = parseBooleanField(req.body.fixedPrice);
        const currency = normalizeCurrencyCode(req.body.currency) || "GBP";
        const parsedTicketLink = parseOptionalUrlField(req.body.ticketLink);
        const ticketLink = parsedTicketLink.value;
        const allowResell = asTrimmedString(req.body.allowResell) || "no";
        const resellCondition = asTrimmedString(req.body.resellCondition) || "When tickets are sold-out";
        const minPrice = freeEvent ? 0 : parseNumericField(req.body.minPrice);
        const maxPrice = freeEvent ? 0 : parseNumericField(req.body.maxPrice);

        const parsedInstagram = parseOptionalUrlField(req.body.instagram);
        const parsedFacebook = parseOptionalUrlField(req.body.facebook);
        const parsedYouTube = parseOptionalUrlField(req.body.youtube);
        const parsedLinkedin = parseOptionalUrlField(req.body.linkedin);
        const parsedWebsite = parseOptionalUrlField(req.body.website);
        const isAdminUser = isAdminRole(user.role);
        const selectedCoHost = isAdminUser ? null : parseCoHostSelection(req.body);

        const onlineLinks = {
            instagram: parsedInstagram.value,
            facebook: parsedFacebook.value,
            youtube: parsedYouTube.value,
            linkedin: parsedLinkedin.value,
            website: parsedWebsite.value,
        };

        // Handle publisher selection (personal or organisation)
        const publisherType = asTrimmedString(req.body.publisherType) || "member";
        const publisherOrganisationId = asTrimmedString(req.body.publisherOrganisationId);
        let validatedPublisherType = "member";
        let validatedPublisherOrganisationId = null;

        if (publisherType === "organisation" && publisherOrganisationId) {
            // Verify that this organisation is owned by or includes the user as a participant (non-admin only)
            if (!isAdminUser) {
                const organisation = await Organisation.findById(publisherOrganisationId);
                if (!canUserPublishForOrganisation(organisation, user._id)) {
                    return res.status(403).json({ success: false, message: "You can only publish events under organisations you belong to" });
                }
                validatedPublisherType = "organisation";
                validatedPublisherOrganisationId = organisation._id;
            }
            // Admin users can publish under any organisation, but we still validate it exists
            else {
                const organisation = await Organisation.findById(publisherOrganisationId);
                if (!organisation) {
                    return res.status(400).json({ success: false, message: "Organisation not found" });
                }
                validatedPublisherType = "organisation";
                validatedPublisherOrganisationId = organisation._id;
            }
        }

        if (!title) {
            return res.status(400).json({ success: false, message: "Title is required" });
        }

        if (!description) {
            return res.status(400).json({ success: false, message: "Description is required" });
        }

        if (description.length > EVENT_DESCRIPTION_MAX_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Description must be ${EVENT_DESCRIPTION_MAX_LENGTH} characters or fewer`,
            });
        }

        if (!parsedTicketLink.isValid) {
            return res.status(400).json({ success: false, message: "Ticket link must be a valid URL" });
        }

        if (!parsedInstagram.isValid || !parsedFacebook.isValid || !parsedYouTube.isValid || !parsedLinkedin.isValid || !parsedWebsite.isValid) {
            return res.status(400).json({ success: false, message: "One or more online links are invalid" });
        }

        if (!address) {
            return res.status(400).json({ success: false, message: "Address is required" });
        }

        if (!validateDate(startDate)) {
            return res.status(400).json({ success: false, message: "Start date is invalid" });
        }

        if (!validateQuarterHourTime(startTime)) {
            return res.status(400).json({ success: false, message: "Start time is invalid. Use 15-minute increments." });
        }

        if (hasEndDateTime && (!endDate || !endTime)) {
            return res.status(400).json({ success: false, message: "Both end date and end time are required" });
        }

        if (endDate && !validateDate(endDate)) {
            return res.status(400).json({ success: false, message: "End date is invalid" });
        }

        if (endDate && endDate < startDate) {
            return res.status(400).json({ success: false, message: "End date cannot be before start date" });
        }

        if (endTime && !validateQuarterHourTime(endTime)) {
            return res.status(400).json({ success: false, message: "End time is invalid. Use 15-minute increments." });
        }

        if (endDate && endTime && `${endDate}T${endTime}` <= `${startDate}T${startTime}`) {
            return res.status(400).json({ success: false, message: "End time must be after start time" });
        }

        if (!EVENT_TYPES.includes(eventType)) {
            return res.status(400).json({ success: false, message: "Event type is invalid" });
        }

        if (!MUSIC_FORMATS.includes(musicFormat)) {
            return res.status(400).json({ success: false, message: "Music format is invalid" });
        }

        if (!TICKET_TYPES.includes(ticketType)) {
            return res.status(400).json({ success: false, message: "Ticket type is invalid" });
        }

        if (!isValidCurrencyCode(currency)) {
            return res.status(400).json({ success: false, message: "Currency is invalid" });
        }

        if (!["yes", "no"].includes(allowResell)) {
            return res.status(400).json({ success: false, message: "Allow re-sell value is invalid" });
        }

        if (allowResell === "yes" && !RESALE_OPTIONS.includes(resellCondition)) {
            return res.status(400).json({ success: false, message: "Re-sell condition is invalid" });
        }

        if (!freeEvent) {
            if (!Number.isFinite(minPrice) || minPrice < 0) {
                return res.status(400).json({ success: false, message: "Minimum price must be a number greater than or equal to 0" });
            }

            if (!Number.isFinite(maxPrice) || maxPrice < 0) {
                return res.status(400).json({ success: false, message: "Maximum price must be a number greater than or equal to 0" });
            }

            if (fixedPrice && minPrice !== maxPrice) {
                return res.status(400).json({ success: false, message: "Fixed price events must have the same minimum and maximum price" });
            }

            if (!fixedPrice && maxPrice < minPrice) {
                return res.status(400).json({ success: false, message: "Maximum price must be greater than or equal to minimum price" });
            }
        }

        uploadedImageAsset = isAdminUser
            ? { imageUrl: "", imageStorageId: "" }
            : req.file
                ? await storeEventImageAsset({ file: req.file, userId: user._id })
                : { imageUrl: "", imageStorageId: "" };

        const event = await CalendarEvent.create({
            createdBy: user._id,
            eventType,
            title,
            description,
            genres,
            musicFormat,
            startDate,
            startTime,
            endDate,
            endTime,
            venue,
            address,
            city,
            onlineEvent,
            ticketType,
            freeEvent,
            minPrice,
            maxPrice,
            fixedPrice,
            currency,
            ticketLink,
            allowResell,
            resellCondition: allowResell === "no" ? "When tickets are sold-out" : resellCondition,
            resellActivated: allowResell === "yes" && resellCondition === "Always",
            onlineLinks,
            coHosts: "",
            coHostContacts: [],
            imageUrl: uploadedImageAsset.imageUrl,
            imageStorageId: uploadedImageAsset.imageStorageId,
            publisherType: validatedPublisherType,
            publisherOrganisationId: validatedPublisherOrganisationId,
        });
        eventCreated = true;

        let coHostInviteWarning = "";
        if (selectedCoHost) {
            try {
                await appendCoHostInvitation({
                    req,
                    event,
                    requesterUser: user,
                    selectedCoHost,
                });
            } catch (inviteError) {
                coHostInviteWarning = inviteError?.message || "Co-host invitation could not be sent.";
            }
        }

        const activityLine = buildActivityLine(title, startDate, startTime);
        const activityItem = {
            type: "event.created",
            entityType: "event",
            entityId: event._id,
            message: activityLine,
            createdAt: new Date(),
        };
        await upsertProfileActivity(user, activityItem);

        const organizerAvatarUrl = await getProfileAvatarByUserId(user._id);
        const organizerDisplayName = await getProfileDisplayNameByUserId(user._id);
        const publisherOrganisationMap = await getOrganisationSummaryMapByIds(
            validatedPublisherOrganisationId ? [String(validatedPublisherOrganisationId)] : []
        );

        return res.status(201).json({
            success: true,
            message: "Event created successfully",
            event: toClientEvent({ ...event.toObject(), createdBy: user }, user._id, {
                organizerAvatarUrl,
                organizerDisplayName,
                publisherOrganisationMap,
            }),
            activityLine,
            activityItem,
            coHostInviteWarning,
        });
    } catch (error) {
        if (!eventCreated && uploadedImageAsset) {
            await deleteEventImageAsset(uploadedImageAsset);
        }
        console.log("Error in createCalendarEvent", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const listCalendarEvents = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await findUserOrReject(userId, res);
        if (!user) return;

        const events = await CalendarEvent.find({})
            .sort({ startDate: 1, startTime: 1, createdAt: -1 })
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email")
            .lean();

        const profileUserIds = events.flatMap((item) => {
            const organizerId = String(item?.createdBy?._id || item?.createdBy || "");
            const attendeeIds = Array.isArray(item?.attendees)
                ? item.attendees.map((attendee) => String(attendee?.user?._id || attendee?.user || ""))
                : [];
            return [organizerId, ...attendeeIds];
        });

        const organizerAvatarMap = await getProfileAvatarMapByUserIds(profileUserIds);
        const displayNameMap = await getProfileDisplayNameMapByUserIds(profileUserIds);
        const organisationSummaryIds = events.flatMap((item) => {
            const coHostOrganisationIds = Array.isArray(item?.coHostContacts)
                ? item.coHostContacts
                    .filter((contact) => asTrimmedString(contact?.entityType) === "organisation")
                    .map((contact) => String(contact?.organisationId || ""))
                : [];
            const publisherOrganisationId = asTrimmedString(item?.publisherType) === "organisation"
                ? String(item?.publisherOrganisationId || "")
                : "";

            return publisherOrganisationId
                ? [...coHostOrganisationIds, publisherOrganisationId]
                : coHostOrganisationIds;
        });
        const organisationSummaryMap = await getOrganisationSummaryMapByIds(organisationSummaryIds);

        return res.status(200).json({
            success: true,
            events: events.map((item) => {
                const createdById = String(item?.createdBy?._id || item?.createdBy || "");
                return toClientEvent(item, user._id, {
                    organizerAvatarUrl: organizerAvatarMap[createdById] || "",
                    organizerDisplayName: displayNameMap[createdById] || "",
                    attendeeDisplayNameMap: displayNameMap,
                    coHostOrganisationMap: organisationSummaryMap,
                    publisherOrganisationMap: organisationSummaryMap,
                });
            }),
        });
    } catch (error) {
        console.log("Error in listCalendarEvents", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getCalendarEventById = async (req, res) => {
    try {
        const { eventId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(String(eventId || ""))) {
            return res.status(400).json({ success: false, message: "Invalid event id" });
        }

        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const event = await CalendarEvent.findById(eventId)
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email")
            .lean();

        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        const profileUserIds = [
            String(event?.createdBy?._id || event?.createdBy || ""),
            ...(Array.isArray(event?.attendees)
                ? event.attendees.map((attendee) => String(attendee?.user?._id || attendee?.user || ""))
                : []),
        ];

        const organizerAvatarUrl = await getProfileAvatarByUserId(String(event?.createdBy?._id || event?.createdBy || ""));
        const displayNameMap = await getProfileDisplayNameMapByUserIds(profileUserIds);
        const coHostOrganisationIds = Array.isArray(event?.coHostContacts)
            ? event.coHostContacts
                .filter((contact) => asTrimmedString(contact?.entityType) === "organisation")
                .map((contact) => String(contact?.organisationId || ""))
            : [];
        const publisherOrganisationId = asTrimmedString(event?.publisherType) === "organisation"
            ? String(event?.publisherOrganisationId || "")
            : "";
        const organisationSummaryMap = await getOrganisationSummaryMapByIds(
            publisherOrganisationId ? [...coHostOrganisationIds, publisherOrganisationId] : coHostOrganisationIds
        );

        return res.status(200).json({
            success: true,
            event: toClientEvent(event, user._id, {
                organizerAvatarUrl,
                organizerDisplayName: displayNameMap[String(event?.createdBy?._id || event?.createdBy || "")] || "",
                attendeeDisplayNameMap: displayNameMap,
                coHostOrganisationMap: organisationSummaryMap,
                publisherOrganisationMap: organisationSummaryMap,
            }),
        });
    } catch (error) {
        console.log("Error in getCalendarEventById", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const updateCalendarEvent = async (req, res) => {
    let uploadedImageAsset = null;
    let eventUpdated = false;
    try {
        const { eventId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(String(eventId || ""))) {
            return res.status(400).json({ success: false, message: "Invalid event id" });
        }

        const user = await findUserOrReject(req.userId, res);
        if (!user) return;
        if (!ensureEventPosterRole(user, res)) return;

        const event = await CalendarEvent.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        if (!canManageEvent(user, event)) {
            return res.status(403).json({ success: false, message: "Only event owners can update events" });
        }

        const updatableFields = [
            "eventType", "title", "description", "musicFormat", "startDate", "startTime", "endDate", "endTime", "venue", "address", "city",
            "onlineEvent", "ticketType", "freeEvent", "fixedPrice", "currency", "ticketLink", "allowResell", "resellCondition", "coHosts",
            "coHostUserId", "coHostType", "coHostOrganisationId", "coHostDisplayName",
            "removedCoHostKeys",
            "instagram", "facebook", "youtube", "linkedin", "website", "genres", "minPrice", "maxPrice",
            "publisherType", "publisherOrganisationId",
        ];

        const updates = {};
        for (const field of updatableFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0 && !req.file) {
            return res.status(400).json({ success: false, message: "No event fields provided to update" });
        }

        // Reuse validation by merging incoming patch onto existing values.
        const nextRequestBody = {
            eventType: updates.eventType ?? event.eventType,
            title: updates.title ?? event.title,
            description: updates.description ?? event.description,
            genres: updates.genres ?? event.genres,
            musicFormat: updates.musicFormat ?? event.musicFormat,
            startDate: updates.startDate ?? event.startDate,
            startTime: updates.startTime ?? event.startTime,
            endDate: updates.endDate ?? event.endDate,
            endTime: updates.endTime ?? event.endTime,
            venue: updates.venue ?? event.venue,
            address: updates.address ?? event.address,
            city: updates.city ?? event.city,
            onlineEvent: updates.onlineEvent ?? event.onlineEvent,
            ticketType: updates.ticketType ?? event.ticketType,
            freeEvent: updates.freeEvent ?? event.freeEvent,
            minPrice: updates.minPrice ?? event.minPrice,
            maxPrice: updates.maxPrice ?? event.maxPrice,
            fixedPrice: updates.fixedPrice ?? event.fixedPrice,
            currency: updates.currency ?? event.currency,
            ticketLink: updates.ticketLink ?? event.ticketLink,
            allowResell: updates.allowResell ?? event.allowResell,
            resellCondition: updates.resellCondition ?? event.resellCondition,
            resellActivated: updates.resellActivated ?? event.resellActivated,
            instagram: updates.instagram ?? event.onlineLinks?.instagram,
            facebook: updates.facebook ?? event.onlineLinks?.facebook,
            youtube: updates.youtube ?? event.onlineLinks?.youtube,
            linkedin: updates.linkedin ?? event.onlineLinks?.linkedin,
            website: updates.website ?? event.onlineLinks?.website,
            coHosts: updates.coHosts ?? event.coHosts,
            coHostUserId: updates.coHostUserId ?? "",
            coHostType: updates.coHostType ?? "",
            coHostOrganisationId: updates.coHostOrganisationId ?? "",
            coHostDisplayName: updates.coHostDisplayName ?? "",
            removedCoHostKeys: updates.removedCoHostKeys ?? [],
            publisherType: updates.publisherType ?? event.publisherType ?? "member",
            publisherOrganisationId: updates.publisherOrganisationId ?? event.publisherOrganisationId ?? null,
        };

        req.body = nextRequestBody;

        // Validate and normalize by calling create parser logic inline.
        const parsedGenres = parseGenres(req.body.genres);
        const parsedInstagram = parseOptionalUrlField(req.body.instagram);
        const parsedFacebook = parseOptionalUrlField(req.body.facebook);
        const parsedYouTube = parseOptionalUrlField(req.body.youtube);
        const parsedLinkedin = parseOptionalUrlField(req.body.linkedin);
        const parsedWebsite = parseOptionalUrlField(req.body.website);
        const parsedTicketLink = parseOptionalUrlField(req.body.ticketLink);

        if (!parsedInstagram.isValid || !parsedFacebook.isValid || !parsedYouTube.isValid || !parsedLinkedin.isValid || !parsedWebsite.isValid || !parsedTicketLink.isValid) {
            return res.status(400).json({ success: false, message: "One or more links are invalid" });
        }

        const normalizedEventType = asTrimmedString(req.body.eventType);
        const normalizedMusicFormat = asTrimmedString(req.body.musicFormat);
        const normalizedTicketType = asTrimmedString(req.body.ticketType);
        const normalizedCurrency = normalizeCurrencyCode(req.body.currency);
        const normalizedAllowResell = asTrimmedString(req.body.allowResell);
        const normalizedResellCondition = asTrimmedString(req.body.resellCondition);
        const normalizedStartDate = asTrimmedString(req.body.startDate);
        const normalizedStartTime = asTrimmedString(req.body.startTime);
        const normalizedEndDateInput = asTrimmedString(req.body.endDate);
        const normalizedEndTime = asTrimmedString(req.body.endTime);
        const hasNormalizedEndDateTime = Boolean(normalizedEndDateInput || normalizedEndTime);
        const normalizedEndDate = hasNormalizedEndDateTime
            ? (normalizedEndDateInput || normalizedStartDate)
            : "";
        const normalizedAddress = asTrimmedString(req.body.address);
        const normalizedCityInput = asTrimmedString(req.body.city);
        const normalizedCity = (normalizedCityInput || inferCityFromAddress(normalizedAddress)).slice(0, 120);

        if (!EVENT_TYPES.includes(normalizedEventType) || !MUSIC_FORMATS.includes(normalizedMusicFormat) || !TICKET_TYPES.includes(normalizedTicketType) || !isValidCurrencyCode(normalizedCurrency)) {
            return res.status(400).json({ success: false, message: "One or more event option values are invalid" });
        }

        if (!["yes", "no"].includes(normalizedAllowResell)) {
            return res.status(400).json({ success: false, message: "Allow re-sell value is invalid" });
        }

        if (normalizedAllowResell === "yes" && !RESALE_OPTIONS.includes(normalizedResellCondition)) {
            return res.status(400).json({ success: false, message: "Re-sell condition is invalid" });
        }

        if (!validateDate(normalizedStartDate) || !validateQuarterHourTime(normalizedStartTime)) {
            return res.status(400).json({ success: false, message: "Date or time values are invalid" });
        }

        if (hasNormalizedEndDateTime && (!normalizedEndDate || !normalizedEndTime)) {
            return res.status(400).json({ success: false, message: "Both end date and end time are required" });
        }

        if (normalizedEndDate && !validateDate(normalizedEndDate)) {
            return res.status(400).json({ success: false, message: "End date is invalid" });
        }

        if (normalizedEndDate && normalizedEndDate < normalizedStartDate) {
            return res.status(400).json({ success: false, message: "End date cannot be before start date" });
        }

        if (normalizedEndTime && !validateQuarterHourTime(normalizedEndTime)) {
            return res.status(400).json({ success: false, message: "Date or time values are invalid" });
        }

        if (normalizedEndDate && normalizedEndTime && `${normalizedEndDate}T${normalizedEndTime}` <= `${normalizedStartDate}T${normalizedStartTime}`) {
            return res.status(400).json({ success: false, message: "End time must be after start time" });
        }

        const normalizedDescription = asTrimmedString(req.body.description);
        if (!normalizedDescription) {
            return res.status(400).json({ success: false, message: "Description is required" });
        }

        if (normalizedDescription.length > EVENT_DESCRIPTION_MAX_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Description must be ${EVENT_DESCRIPTION_MAX_LENGTH} characters or fewer`,
            });
        }

        const normalizedFreeEvent = parseBooleanField(req.body.freeEvent);
        const normalizedFixedPrice = parseBooleanField(req.body.fixedPrice);
        const normalizedMinPrice = normalizedFreeEvent ? 0 : parseNumericField(req.body.minPrice);
        const normalizedMaxPrice = normalizedFreeEvent ? 0 : parseNumericField(req.body.maxPrice);

        if (!normalizedFreeEvent) {
            if (!Number.isFinite(normalizedMinPrice) || normalizedMinPrice < 0 || !Number.isFinite(normalizedMaxPrice) || normalizedMaxPrice < 0) {
                return res.status(400).json({ success: false, message: "Price fields must be numbers greater than or equal to 0" });
            }

            if (normalizedFixedPrice && normalizedMinPrice !== normalizedMaxPrice) {
                return res.status(400).json({ success: false, message: "Fixed price events must have matching min and max price" });
            }

            if (!normalizedFixedPrice && normalizedMaxPrice < normalizedMinPrice) {
                return res.status(400).json({ success: false, message: "Maximum price must be greater than or equal to minimum price" });
            }
        }

        event.eventType = normalizedEventType;
        event.title = asTrimmedString(req.body.title);
        event.description = normalizedDescription;
        event.genres = parsedGenres;
        event.musicFormat = normalizedMusicFormat;
        event.startDate = normalizedStartDate;
        event.startTime = normalizedStartTime;
        event.endDate = normalizedEndDate;
        event.endTime = normalizedEndTime;
        event.venue = asTrimmedString(req.body.venue);
        event.address = normalizedAddress;
        event.city = normalizedCity;
        event.onlineEvent = parseBooleanField(req.body.onlineEvent);
        event.ticketType = normalizedTicketType;
        event.freeEvent = normalizedFreeEvent;
        event.minPrice = normalizedMinPrice;
        event.maxPrice = normalizedMaxPrice;
        event.fixedPrice = normalizedFixedPrice;
        event.currency = normalizedCurrency;
        event.ticketLink = parsedTicketLink.value;
        event.allowResell = normalizedAllowResell;
        event.resellCondition = normalizedAllowResell === "no" ? "When tickets are sold-out" : normalizedResellCondition;
        event.resellActivated = normalizedAllowResell === "yes" && normalizedResellCondition === "Always"
            ? true
            : (normalizedAllowResell === "yes" ? Boolean(event.resellActivated) : false);
        event.onlineLinks = {
            instagram: parsedInstagram.value,
            facebook: parsedFacebook.value,
            youtube: parsedYouTube.value,
            linkedin: parsedLinkedin.value,
            website: parsedWebsite.value,
        };

        const isAdminUser = isAdminRole(user.role);

        // Handle publisher selection update (personal or organisation)
        const publisherType = asTrimmedString(req.body.publisherType) || event.publisherType || "member";
        const publisherOrganisationId = asTrimmedString(req.body.publisherOrganisationId);
        let validatedPublisherType = publisherType;
        let validatedPublisherOrganisationId = event.publisherOrganisationId;

        if (publisherType === "organisation" && publisherOrganisationId) {
            // Verify that this organisation is owned by or includes the user as a participant (non-admin only)
            if (!isAdminUser) {
                const organisation = await Organisation.findById(publisherOrganisationId);
                if (!canUserPublishForOrganisation(organisation, user._id)) {
                    return res.status(403).json({ success: false, message: "You can only publish events under organisations you belong to" });
                }
                validatedPublisherType = "organisation";
                validatedPublisherOrganisationId = organisation._id;
            }
            // Admin users can publish under any organisation, but we still validate it exists
            else {
                const organisation = await Organisation.findById(publisherOrganisationId);
                if (!organisation) {
                    return res.status(400).json({ success: false, message: "Organisation not found" });
                }
                validatedPublisherType = "organisation";
                validatedPublisherOrganisationId = organisation._id;
            }
        } else if (publisherType === "member") {
            validatedPublisherType = "member";
            validatedPublisherOrganisationId = null;
        }

        event.publisherType = validatedPublisherType;
        event.publisherOrganisationId = validatedPublisherOrganisationId;
        const removedCoHostKeys = isAdminUser
            ? []
            : parseRemovedCoHostKeys(req.body.removedCoHostKeys);
        if (removedCoHostKeys.length > 0) {
            const removalSet = new Set(removedCoHostKeys);
            event.coHostContacts = (Array.isArray(event.coHostContacts) ? event.coHostContacts : [])
                .filter((contact) => !removalSet.has(buildCoHostContactKey(contact)));
        }

        event.coHosts = buildCoHostsTextFromContacts(event.coHostContacts);

        const previousImageUrl = event.imageUrl;
        const previousImageStorageId = event.imageStorageId;

        if (req.file && !isAdminUser) {
            uploadedImageAsset = await storeEventImageAsset({ file: req.file, userId: user._id });
            event.imageUrl = uploadedImageAsset.imageUrl;
            event.imageStorageId = uploadedImageAsset.imageStorageId;
        }

        await event.save();
        eventUpdated = true;

        const selectedCoHost = isAdminUser ? null : parseCoHostSelection(req.body);
        let coHostInviteWarning = "";
        if (selectedCoHost) {
            try {
                await appendCoHostInvitation({
                    req,
                    event,
                    requesterUser: user,
                    selectedCoHost,
                });
            } catch (inviteError) {
                coHostInviteWarning = inviteError?.message || "Co-host invitation could not be sent.";
            }
        }

        if (uploadedImageAsset) {
            await deleteEventImageAsset({ imageUrl: previousImageUrl, imageStorageId: previousImageStorageId });
        }
        await upsertProfileActivity(user, {
            type: "event.updated",
            entityType: "event",
            entityId: event._id,
            message: `Updated event: ${event.title}`,
            createdAt: new Date(),
        });

        const populated = await CalendarEvent.findById(event._id)
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email")
            .lean();
        const profileUserIds = [
            String(populated?.createdBy?._id || populated?.createdBy || ""),
            ...(Array.isArray(populated?.attendees)
                ? populated.attendees.map((attendee) => String(attendee?.user?._id || attendee?.user || ""))
                : []),
        ];
        const organizerAvatarUrl = await getProfileAvatarByUserId(String(populated?.createdBy?._id || populated?.createdBy || ""));
        const displayNameMap = await getProfileDisplayNameMapByUserIds(profileUserIds);
        const coHostOrganisationIds = Array.isArray(populated?.coHostContacts)
            ? populated.coHostContacts
                .filter((contact) => asTrimmedString(contact?.entityType) === "organisation")
                .map((contact) => String(contact?.organisationId || ""))
            : [];
        const publisherOrganisationIdForDisplay = asTrimmedString(populated?.publisherType) === "organisation"
            ? String(populated?.publisherOrganisationId || "")
            : "";
        const organisationSummaryMap = await getOrganisationSummaryMapByIds(
            publisherOrganisationIdForDisplay ? [...coHostOrganisationIds, publisherOrganisationIdForDisplay] : coHostOrganisationIds
        );
        return res.status(200).json({
            success: true,
            message: "Event updated successfully",
            event: toClientEvent(populated, user._id, {
                organizerAvatarUrl,
                organizerDisplayName: displayNameMap[String(populated?.createdBy?._id || populated?.createdBy || "")] || "",
                attendeeDisplayNameMap: displayNameMap,
                coHostOrganisationMap: organisationSummaryMap,
                publisherOrganisationMap: organisationSummaryMap,
            }),
            coHostInviteWarning,
        });
    } catch (error) {
        if (!eventUpdated && uploadedImageAsset) {
            await deleteEventImageAsset(uploadedImageAsset);
        }
        console.log("Error in updateCalendarEvent", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const deleteCalendarEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(String(eventId || ""))) {
            return res.status(400).json({ success: false, message: "Invalid event id" });
        }

        const user = await findUserOrReject(req.userId, res);
        if (!user) return;
        if (!ensureEventPosterRole(user, res)) return;

        const event = await CalendarEvent.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        const isAdminUser = isAdminRole(user.role);
        if (!isAdminUser && !canManageEvent(user, event)) {
            return res.status(403).json({ success: false, message: "Only event owners can delete events" });
        }

        const eventOwnerId = String(event?.createdBy?._id || event?.createdBy || "");
        await CalendarEvent.findByIdAndDelete(event._id);
        await deleteEventImageAsset({
            imageUrl: asTrimmedString(event.imageUrl),
            imageStorageId: asTrimmedString(event.imageStorageId),
        });
        if (eventOwnerId && mongoose.Types.ObjectId.isValid(eventOwnerId)) {
            await removeEventActivityFromProfile(eventOwnerId, event._id);
        }

        return res.status(200).json({
            success: true,
            message: "Event deleted successfully",
            deletedEventId: String(event._id),
        });
    } catch (error) {
        console.log("Error in deleteCalendarEvent", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const markCalendarEventGoing = async (req, res) => {
    try {
        const { eventId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(String(eventId || ""))) {
            return res.status(400).json({ success: false, message: "Invalid event id" });
        }

        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        if (isAdminRole(user.role)) {
            return res.status(403).json({ success: false, message: "Admins cannot mark Going on events." });
        }

        const event = await CalendarEvent.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        if (String(event.createdBy || "") === String(user._id)) {
            return res.status(400).json({ success: false, message: "Hosts cannot mark Going on their own events." });
        }

        const alreadyGoing = Array.isArray(event.attendees)
            && event.attendees.some((attendee) => String(attendee?.user || "") === String(user._id));

        if (!alreadyGoing) {
            const profile = await Profile.findOne({ user: user._id }).select("avatarUrl").lean();
            const avatarUrl = normalizeAttendeeAvatar(profile?.avatarUrl);

            event.attendees.push({
                user: user._id,
                avatarUrl,
                resaleTicketCount: 0,
            });
        } else {
            event.attendees = (Array.isArray(event.attendees) ? event.attendees : [])
                .filter((attendee) => String(attendee?.user || "") !== String(user._id));
        }

        await event.save();

        const populated = await CalendarEvent.findById(event._id)
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email")
            .lean();
        const profileUserIds = [
            String(populated?.createdBy?._id || populated?.createdBy || ""),
            ...(Array.isArray(populated?.attendees)
                ? populated.attendees.map((attendee) => String(attendee?.user?._id || attendee?.user || ""))
                : []),
        ];
        const organizerAvatarUrl = await getProfileAvatarByUserId(String(populated?.createdBy?._id || populated?.createdBy || ""));
        const displayNameMap = await getProfileDisplayNameMapByUserIds(profileUserIds);
        const coHostOrganisationIds = Array.isArray(populated?.coHostContacts)
            ? populated.coHostContacts
                .filter((contact) => asTrimmedString(contact?.entityType) === "organisation")
                .map((contact) => String(contact?.organisationId || ""))
            : [];
        const publisherOrganisationId = asTrimmedString(populated?.publisherType) === "organisation"
            ? String(populated?.publisherOrganisationId || "")
            : "";
        const organisationSummaryMap = await getOrganisationSummaryMapByIds(
            publisherOrganisationId ? [...coHostOrganisationIds, publisherOrganisationId] : coHostOrganisationIds
        );

        return res.status(200).json({
            success: true,
            message: alreadyGoing ? "Marked as not going." : "Marked as going.",
            event: toClientEvent(populated, user._id, {
                organizerAvatarUrl,
                organizerDisplayName: displayNameMap[String(populated?.createdBy?._id || populated?.createdBy || "")] || "",
                attendeeDisplayNameMap: displayNameMap,
                coHostOrganisationMap: organisationSummaryMap,
                publisherOrganisationMap: organisationSummaryMap,
            }),
        });
    } catch (error) {
        console.log("Error in markCalendarEventGoing", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const updateCalendarEventResellAvailability = async (req, res) => {
    try {
        const { eventId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(String(eventId || ""))) {
            return res.status(400).json({ success: false, message: "Invalid event id" });
        }

        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const event = await CalendarEvent.findById(eventId)
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email");
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        if (!canManageEvent(user, event)) {
            return res.status(403).json({ success: false, message: "Only the event organiser can update ticket re-sell availability" });
        }

        const soldOutStatus = asTrimmedString(req.body.soldOutStatus);
        if (!["sold-out", "not-sold-out"].includes(soldOutStatus)) {
            return res.status(400).json({ success: false, message: "Sold-out status is invalid" });
        }

        if (asTrimmedString(event.allowResell) !== "yes") {
            return res.status(400).json({ success: false, message: "Ticket re-sell is disabled for this event" });
        }

        if (asTrimmedString(event.resellCondition) !== "When tickets are sold-out") {
            return res.status(400).json({ success: false, message: "This event does not require sold-out confirmation" });
        }

        event.resellActivated = soldOutStatus === "sold-out";
        if (!event.resellActivated) {
            const attendees = Array.isArray(event.attendees) ? event.attendees : [];
            for (const attendee of attendees) {
                attendee.resaleTicketCount = 0;
            }
        }

        await event.save();

        const profileUserIds = [
            String(event?.createdBy?._id || event?.createdBy || ""),
            ...(Array.isArray(event?.attendees)
                ? event.attendees.map((attendee) => String(attendee?.user?._id || attendee?.user || ""))
                : []),
        ];
        const organizerAvatarUrl = await getProfileAvatarByUserId(String(event?.createdBy?._id || event?.createdBy || ""));
        const displayNameMap = await getProfileDisplayNameMapByUserIds(profileUserIds);
        const coHostOrganisationIds = Array.isArray(event?.coHostContacts)
            ? event.coHostContacts
                .filter((contact) => asTrimmedString(contact?.entityType) === "organisation")
                .map((contact) => String(contact?.organisationId || ""))
            : [];
        const publisherOrganisationId = asTrimmedString(event?.publisherType) === "organisation"
            ? String(event?.publisherOrganisationId || "")
            : "";
        const organisationSummaryMap = await getOrganisationSummaryMapByIds(
            publisherOrganisationId ? [...coHostOrganisationIds, publisherOrganisationId] : coHostOrganisationIds
        );

        return res.status(200).json({
            success: true,
            message: "Ticket re-sell availability updated",
            event: toClientEvent(event.toObject(), user._id, {
                organizerAvatarUrl,
                organizerDisplayName: displayNameMap[String(event?.createdBy?._id || event?.createdBy || "")] || "",
                attendeeDisplayNameMap: displayNameMap,
                coHostOrganisationMap: organisationSummaryMap,
                publisherOrganisationMap: organisationSummaryMap,
            }),
        });
    } catch (error) {
        console.log("Error in updateCalendarEventResellAvailability", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const updateCalendarEventResellTickets = async (req, res) => {
    try {
        const { eventId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(String(eventId || ""))) {
            return res.status(400).json({ success: false, message: "Invalid event id" });
        }

        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const event = await CalendarEvent.findById(eventId)
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email");
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        if (!isResellOpenForEvent(event)) {
            return res.status(400).json({ success: false, message: "Ticket re-sell is not currently available" });
        }

        const rawTicketCount = Number(req.body.ticketCount);
        if (!Number.isInteger(rawTicketCount) || rawTicketCount < 0 || rawTicketCount > RESALE_TICKETS_MAX) {
            return res.status(400).json({ success: false, message: `Ticket count must be between 0 and ${RESALE_TICKETS_MAX}` });
        }

        const profileAvatarUrl = rawTicketCount > 0 ? await getProfileAvatarByUserId(user._id) : "";

        const attendeeIndex = Array.isArray(event.attendees)
            ? event.attendees.findIndex((attendee) => String(attendee?.user?._id || attendee?.user || "") === String(user._id))
            : -1;

        if (attendeeIndex < 0 && rawTicketCount > 0) {
            event.attendees.push({
                user: user._id,
                avatarUrl: profileAvatarUrl,
                resaleTicketCount: rawTicketCount,
            });
        } else if (attendeeIndex >= 0) {
            event.attendees[attendeeIndex].resaleTicketCount = rawTicketCount;

            if (rawTicketCount > 0) {
                event.attendees[attendeeIndex].avatarUrl = profileAvatarUrl;
            }
        }
        await event.save();

        const profileUserIds = [
            String(event?.createdBy?._id || event?.createdBy || ""),
            ...(Array.isArray(event?.attendees)
                ? event.attendees.map((attendee) => String(attendee?.user?._id || attendee?.user || ""))
                : []),
        ];
        const organizerAvatarUrl = await getProfileAvatarByUserId(String(event?.createdBy?._id || event?.createdBy || ""));
        const displayNameMap = await getProfileDisplayNameMapByUserIds(profileUserIds);
        const coHostOrganisationIds = Array.isArray(event?.coHostContacts)
            ? event.coHostContacts
                .filter((contact) => asTrimmedString(contact?.entityType) === "organisation")
                .map((contact) => String(contact?.organisationId || ""))
            : [];
        const publisherOrganisationId = asTrimmedString(event?.publisherType) === "organisation"
            ? String(event?.publisherOrganisationId || "")
            : "";
        const organisationSummaryMap = await getOrganisationSummaryMapByIds(
            publisherOrganisationId ? [...coHostOrganisationIds, publisherOrganisationId] : coHostOrganisationIds
        );

        return res.status(200).json({
            success: true,
            message: rawTicketCount === 0 ? "Re-sell ticket removed" : "Re-sell tickets updated",
            event: toClientEvent(event.toObject(), user._id, {
                organizerAvatarUrl,
                organizerDisplayName: displayNameMap[String(event?.createdBy?._id || event?.createdBy || "")] || "",
                attendeeDisplayNameMap: displayNameMap,
                coHostOrganisationMap: organisationSummaryMap,
                publisherOrganisationMap: organisationSummaryMap,
            }),
        });
    } catch (error) {
        console.log("Error in updateCalendarEventResellTickets", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getPendingCoHostInvitations = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const profile = await Profile.findOne({ user: user._id }).lean();
        if (!profile) {
            return res.status(200).json({ success: true, invitations: [] });
        }

        const pendingInvitations = (Array.isArray(profile.pendingCoHostInvitations) ? profile.pendingCoHostInvitations : [])
            .filter((invite) => {
                const expiresAt = invite?.expiresAt ? new Date(invite.expiresAt).getTime() : 0;
                return expiresAt > Date.now();
            })
            .map((invite) => {
                const contactType = asTrimmedString(invite?.contactType) === "organisation" ? "organisation" : "member";
                const contactDisplayName = asTrimmedString(invite?.contactDisplayName) || "this contact";

                return {
                    tokenHash: asTrimmedString(invite?.tokenHash),
                    eventId: String(invite?.eventId || ""),
                    eventTitle: asTrimmedString(invite?.eventTitle) || "Untitled event",
                    invitedBy: String(invite?.invitedBy || ""),
                    inviterName: asTrimmedString(invite?.invitedByName) || "A Swinggity member",
                    inviterAvatarUrl: asTrimmedString(invite?.invitedByAvatarUrl),
                    invitedAt: invite?.invitedAt || new Date(),
                    expiresAt: invite?.expiresAt || new Date(),
                    notificationType: "cohost",
                    inviteText: contactType === "organisation"
                        ? `invited ${contactDisplayName} to co-host an event`
                        : "invited you to co-host an event",
                };
            });

        return res.status(200).json({
            success: true,
            invitations: pendingInvitations,
        });
    } catch (error) {
        console.log("Error in getPendingCoHostInvitations", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getPendingCoHostStatusNotifications = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const profile = await Profile.findOne({ user: user._id }).lean();
        if (!profile) {
            return res.status(200).json({ success: true, notifications: [] });
        }

        const notifications = (Array.isArray(profile.coHostInvitationResponses) ? profile.coHostInvitationResponses : [])
            .map((item) => {
                const response = asTrimmedString(item?.response) === "accept" ? "accept" : "deny";
                const eventTitle = asTrimmedString(item?.eventTitle) || "your event";
                return {
                    notificationId: String(item?._id || ""),
                    inviterName: asTrimmedString(item?.inviteeName) || "A Swinggity member",
                    inviterAvatarUrl: asTrimmedString(item?.inviteeAvatarUrl),
                    eventId: String(item?.eventId || ""),
                    eventTitle,
                    response,
                    invitedAt: item?.respondedAt || new Date(),
                    notificationType: "cohost-status",
                    inviteText: response === "accept"
                        ? `accepted your co-host request for ${eventTitle}`
                        : `denied your co-host request for ${eventTitle}`,
                };
            })
            .sort((left, right) => new Date(right?.invitedAt || 0).getTime() - new Date(left?.invitedAt || 0).getTime());

        return res.status(200).json({
            success: true,
            notifications,
        });
    } catch (error) {
        console.log("Error in getPendingCoHostStatusNotifications", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const dismissCoHostStatusNotification = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const notificationId = asTrimmedString(req.body?.notificationId);
        if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
            return res.status(400).json({ success: false, message: "Invalid notification id" });
        }

        const profile = await Profile.findOne({ user: user._id });
        if (!profile) {
            return res.status(404).json({ success: false, message: "Profile not found" });
        }

        const currentItems = Array.isArray(profile.coHostInvitationResponses)
            ? profile.coHostInvitationResponses
            : [];
        profile.coHostInvitationResponses = currentItems.filter(
            (item) => String(item?._id || "") !== notificationId
        );
        await profile.save();

        return res.status(200).json({ success: true, message: "Notification dismissed" });
    } catch (error) {
        console.log("Error in dismissCoHostStatusNotification", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const respondToCoHostInvitationInApp = async (req, res) => {
    try {
        const userId = String(req.userId || "");
        const { tokenHash, action } = req.body;

        if (!asTrimmedString(tokenHash)) {
            return res.status(400).json({ success: false, message: "Invalid invitation token" });
        }

        if (action !== "accept" && action !== "deny") {
            return res.status(400).json({ success: false, message: "Invalid action" });
        }

        const profile = await Profile.findOne({ user: userId });
        if (!profile) {
            return res.status(404).json({ success: false, message: "Profile not found" });
        }

        const pendingInvites = Array.isArray(profile.pendingCoHostInvitations)
            ? profile.pendingCoHostInvitations
            : [];
        const invitation = pendingInvites.find((item) => asTrimmedString(item?.tokenHash) === asTrimmedString(tokenHash));

        if (!invitation) {
            return res.status(404).json({ success: false, message: "Invitation not found" });
        }

        if (!invitation.expiresAt || new Date(invitation.expiresAt).getTime() < Date.now()) {
            profile.pendingCoHostInvitations = pendingInvites.filter((item) => asTrimmedString(item?.tokenHash) !== asTrimmedString(tokenHash));
            await profile.save();
            return res.status(410).json({ success: false, message: "This invitation has expired" });
        }

        profile.pendingCoHostInvitations = pendingInvites.filter((item) => asTrimmedString(item?.tokenHash) !== asTrimmedString(tokenHash));

        if (action === "accept") {
            await applyAcceptedCoHostToEvent(profile, invitation);
        }

        await profile.save();
        await appendCoHostResponseNotification({ invitation, inviteeProfile: profile, action });

        return res.status(200).json({
            success: true,
            message: action === "accept" ? "Co-host request accepted" : "Co-host request denied",
        });
    } catch (error) {
        console.log("Error in respondToCoHostInvitationInApp", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const respondToCoHostInvitation = async (req, res) => {
    try {
        const { token, action } = req.query;

        if (!token || typeof token !== "string") {
            return res.status(400).send("Invalid invitation token.");
        }

        if (action !== "accept" && action !== "deny") {
            return res.status(400).send("Invalid invitation action.");
        }

        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const profile = await Profile.findOne({ "pendingCoHostInvitations.tokenHash": tokenHash });
        if (!profile) {
            return res.status(404).send("This invitation was not found or has already been used.");
        }

        const pendingInvites = Array.isArray(profile.pendingCoHostInvitations)
            ? profile.pendingCoHostInvitations
            : [];
        const invitation = pendingInvites.find((item) => asTrimmedString(item?.tokenHash) === tokenHash);
        if (!invitation) {
            return res.status(404).send("This invitation was not found or has already been used.");
        }

        if (!invitation.expiresAt || new Date(invitation.expiresAt).getTime() < Date.now()) {
            profile.pendingCoHostInvitations = pendingInvites.filter((item) => asTrimmedString(item?.tokenHash) !== tokenHash);
            await profile.save();
            return res.status(410).send("This invitation has expired.");
        }

        profile.pendingCoHostInvitations = pendingInvites.filter((item) => asTrimmedString(item?.tokenHash) !== tokenHash);

        if (action === "accept") {
            await applyAcceptedCoHostToEvent(profile, invitation);
        }

        await profile.save();
        await appendCoHostResponseNotification({ invitation, inviteeProfile: profile, action });

        const statusText = action === "accept" ? "accepted" : "denied";
        const actionMessage = action === "accept"
            ? "Co-host request accepted. Your contact will now be shown on the event overview."
            : "Co-host request denied. Your contact will not be shown on the event.";

        return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Co-host invitation ${statusText}</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; color: #333; max-width: 620px; margin: 40px auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; text-transform: capitalize;">Co-host request ${statusText}</h1>
  </div>
  <div style="background: #fff; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p style="margin: 0;">${actionMessage}</p>
  </div>
</body>
</html>
`);
    } catch (error) {
        console.log("Error in respondToCoHostInvitation", error);
        return res.status(500).send("Something went wrong while processing this invitation.");
    }
};

export const submitOrganiserVerificationRequest = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        if (ALLOWED_ROLES.includes(asTrimmedString(user.role))) {
            return res.status(400).json({
                success: false,
                message: "Organiser and admin users can already publish events.",
            });
        }

        const message = asTrimmedString(req.body?.message);
        const allowEmailContact = parseBooleanField(req.body?.allowEmailContact);
        const allowPhoneContact = parseBooleanField(req.body?.allowPhoneContact);

        if (!message) {
            return res.status(400).json({ success: false, message: "Please provide a message before sending your request." });
        }

        if (countWords(message) > CONTACT_MESSAGE_MAX_WORDS) {
            return res.status(400).json({ success: false, message: `Message must be ${CONTACT_MESSAGE_MAX_WORDS} words or fewer.` });
        }

        if (!allowEmailContact && !allowPhoneContact) {
            return res.status(400).json({ success: false, message: "Choose at least one contact method." });
        }

        const profile = await Profile.findOne({ user: user._id }).lean();
        const profilePhoneNumber = asTrimmedString(profile?.phoneNumber);
        const profileEmail = asTrimmedString(profile?.contactEmail);
        const accountEmail = asTrimmedString(user.email);
        const resolvedEmail = profileEmail || accountEmail;

        if (allowPhoneContact && !profilePhoneNumber) {
            return res.status(400).json({
                success: false,
                message: "You haven't provided your phone number. Please add your phone number on your profile edit or select Email",
            });
        }

        if (allowEmailContact && !resolvedEmail) {
            return res.status(400).json({
                success: false,
                message: "You haven't provided your email. Please add your email on your profile edit or select Phone Number",
            });
        }

        const displayFirstName = asTrimmedString(profile?.displayFirstName) || asTrimmedString(user.firstName);
        const displayLastName = asTrimmedString(profile?.displayLastName) || asTrimmedString(user.lastName);
        const requesterName = `${displayFirstName} ${displayLastName}`.trim() || resolvedEmail || "Swinggity user";

        const contactMethods = [];
        if (allowEmailContact) {
            contactMethods.push(`<li><strong>Email:</strong> ${escapeHtml(resolvedEmail)}</li>`);
        }
        if (allowPhoneContact) {
            contactMethods.push(`<li><strong>Phone Number:</strong> ${escapeHtml(profilePhoneNumber)}</li>`);
        }

        await sendOrganiserVerificationRequestEmail({
            requesterName: escapeHtml(requesterName),
            requesterMessage: escapeHtml(message).replaceAll("\n", "<br />"),
            contactMethodsHtml: contactMethods.join(""),
        });

        return res.status(200).json({
            success: true,
            message: "Request sent successfully.",
        });
    } catch (error) {
        console.log("Error in submitOrganiserVerificationRequest", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const autocompletePlaces = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const apiKey = resolveGeoapifyApiKey();
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "Geoapify autocomplete is not configured on the server.",
            });
        }

        const input = asTrimmedString(req.query?.input).slice(0, 120);
        if (input.length < 2) {
            return res.status(200).json({ success: true, suggestions: [] });
        }

        const requestedCountry = asTrimmedString(req.query?.country).toLowerCase();
        const countryCode = /^[a-z]{2}$/.test(requestedCountry) ? requestedCountry : "";

        const query = new URLSearchParams({
            text: input,
            apiKey,
            format: "json",
            limit: "8",
        });

        if (countryCode) {
            query.set("filter", `countrycode:${countryCode}`);
        }

        const response = await fetch(`${GEOAPIFY_AUTOCOMPLETE_URL}?${query.toString()}`);
        if (!response.ok) {
            return res.status(502).json({
                success: false,
                message: "Unable to reach Geoapify autocomplete service.",
            });
        }

        const payload = await response.json();
        const results = Array.isArray(payload?.results) ? payload.results : [];

        const suggestions = results
            .map((item, index) => {
                const formatted = asTrimmedString(item?.formatted);
                const line1 = asTrimmedString(item?.address_line1) || asTrimmedString(item?.name);
                const line2 = asTrimmedString(item?.address_line2);
                const placeId = asTrimmedString(item?.place_id);
                const countryCode = asTrimmedString(item?.country_code).toLowerCase();
                const currency = resolveCurrencyFromCountryCode(countryCode);
                const city = asTrimmedString(item?.city)
                    || asTrimmedString(item?.town)
                    || asTrimmedString(item?.village)
                    || asTrimmedString(item?.county)
                    || asTrimmedString(item?.state);

                return {
                    id: placeId || `${formatted}-${index}`,
                    placeId,
                    primaryText: line1 || formatted,
                    secondaryText: line2,
                    description: formatted || [line1, line2].filter(Boolean).join(", "),
                    city,
                    countryCode,
                    currency,
                };
            })
            .filter((item) => item.description);

        return res.status(200).json({ success: true, suggestions });
    } catch (error) {
        console.log("Error in autocompletePlaces", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const autocompleteCities = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const apiKey = resolveGeoapifyApiKey();
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "Geoapify autocomplete is not configured on the server.",
            });
        }

        const input = asTrimmedString(req.query?.input).slice(0, 120);
        if (input.length < 1) {
            return res.status(200).json({ success: true, suggestions: [] });
        }

        const query = new URLSearchParams({
            text: input,
            apiKey,
            format: "json",
            limit: "12",
            type: "city",
        });

        const response = await fetch(`${GEOAPIFY_AUTOCOMPLETE_URL}?${query.toString()}`);
        if (!response.ok) {
            return res.status(502).json({
                success: false,
                message: "Unable to reach Geoapify city service.",
            });
        }

        const payload = await response.json();
        const results = Array.isArray(payload?.results) ? payload.results : [];

        const suggestions = results
            .map((item, index) => {
                const city = asTrimmedString(item?.city)
                    || asTrimmedString(item?.town)
                    || asTrimmedString(item?.village)
                    || asTrimmedString(item?.county)
                    || asTrimmedString(item?.state)
                    || asTrimmedString(item?.name);
                const country = asTrimmedString(item?.country);
                const formatted = asTrimmedString(item?.formatted);
                const placeId = asTrimmedString(item?.place_id);
                const lat = Number(item?.lat);
                const lon = Number(item?.lon);

                return {
                    id: placeId || `${city}-${country}-${index}`,
                    placeId,
                    city,
                    country,
                    description: [city, country].filter(Boolean).join(", ") || formatted,
                    lat: Number.isFinite(lat) ? lat : null,
                    lon: Number.isFinite(lon) ? lon : null,
                };
            })
            .filter((item) => item.city && item.description)
            .filter((item, index, items) => (
                items.findIndex((other) => (
                    other.city.toLowerCase() === item.city.toLowerCase()
                    && other.country.toLowerCase() === item.country.toLowerCase()
                )) === index
            ));

        return res.status(200).json({ success: true, suggestions });
    } catch (error) {
        console.log("Error in autocompleteCities", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const reverseCityLookup = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const apiKey = resolveGeoapifyApiKey();
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "Geoapify reverse geocoding is not configured on the server.",
            });
        }

        const lat = Number(req.query?.lat);
        const lon = Number(req.query?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return res.status(400).json({ success: false, message: "Invalid coordinates." });
        }

        const query = new URLSearchParams({
            apiKey,
            format: "json",
            lat: String(lat),
            lon: String(lon),
        });

        const response = await fetch(`${GEOAPIFY_REVERSE_URL}?${query.toString()}`);
        if (!response.ok) {
            return res.status(502).json({
                success: false,
                message: "Unable to reach Geoapify reverse geocoding service.",
            });
        }

        const payload = await response.json();
        const firstResult = Array.isArray(payload?.results) ? payload.results[0] : null;
        const city = asTrimmedString(firstResult?.city)
            || asTrimmedString(firstResult?.town)
            || asTrimmedString(firstResult?.village)
            || asTrimmedString(firstResult?.county)
            || asTrimmedString(firstResult?.state)
            || asTrimmedString(firstResult?.name);
        const country = asTrimmedString(firstResult?.country);

        return res.status(200).json({
            success: true,
            city,
            country,
            description: [city, country].filter(Boolean).join(", "),
        });
    } catch (error) {
        console.log("Error in reverseCityLookup", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
