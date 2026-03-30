import { CalendarEvent } from "../models/calendarEvent.model.js";
import { User } from "../models/user.model.js";
import { Profile } from "../models/profile.model.js";
import mongoose from "mongoose";
import { sendOrganiserVerificationRequestEmail } from "../mailtrap/emails.js";

const EVENT_TYPES = ["Social", "Class", "Workshop", "Festival"];
const MUSIC_FORMATS = ["All", "DJ", "Live music"];
const TICKET_TYPES = ["prepaid", "door"];
const CURRENCIES = ["GBP", "EUR", "USD"];
const RESALE_OPTIONS = ["When tickets are sold-out", "Always"];
const ALLOWED_ROLES = ["organiser", "organizer", "admin"];
const CONTACT_MESSAGE_MAX_WORDS = 200;
const GEOAPIFY_AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete";

const resolveGeoapifyApiKey = () => {
    const directKey = asTrimmedString(process.env.GEOAPIFY_API_KEY);
    if (directKey) {
        return directKey;
    }

    const fallback = asTrimmedString(process.env.GEOAPIFY_KEY);
    if (!fallback) {
        return "";
    }

    // Support accidental full URL values by extracting apiKey=... from query string.
    if (/^https?:\/\//i.test(fallback)) {
        try {
            const parsed = new URL(fallback);
            return asTrimmedString(parsed.searchParams.get("apiKey"));
        } catch {
            return "";
        }
    }

    return fallback;
};

const asTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");

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

const canManageEvent = (user, event) => {
    if (!user || !event) return false;
    const isOwner = String(event.createdBy || "") === String(user._id || "");
    return isOwner;
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

const toClientEvent = (eventDoc, currentUserId) => {
    const host = eventDoc?.createdBy;
    const firstName = asTrimmedString(host?.firstName);
    const lastName = asTrimmedString(host?.lastName);
    const organizerName = `${firstName} ${lastName}`.trim() || host?.email || "Swinggity Host";
    const createdById = String(host?._id || eventDoc?.createdBy || "");

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
        endTime: eventDoc?.endTime || "",
        venue: eventDoc?.venue || "",
        address: eventDoc?.address || "",
        onlineEvent: Boolean(eventDoc?.onlineEvent),
        ticketType: eventDoc?.ticketType || "prepaid",
        freeEvent: Boolean(eventDoc?.freeEvent),
        minPrice: Number.isFinite(eventDoc?.minPrice) ? eventDoc.minPrice : 0,
        maxPrice: Number.isFinite(eventDoc?.maxPrice) ? eventDoc.maxPrice : 0,
        fixedPrice: Boolean(eventDoc?.fixedPrice),
        currency: eventDoc?.currency || "GBP",
        ticketLink: eventDoc?.ticketLink || "",
        allowResell: eventDoc?.allowResell || "yes",
        resellCondition: eventDoc?.resellCondition || "When tickets are sold-out",
        socialLinks: eventDoc?.socialLinks || {
            instagram: "",
            facebook: "",
            youtube: "",
            linkedin: "",
            website: "",
        },
        coHosts: eventDoc?.coHosts || "",
        imageUrl: eventDoc?.imageUrl || "",
        organizerName,
        attendeesCount: 0,
        canEdit: String(currentUserId || "") === createdById,
        createdAt: eventDoc?.createdAt,
        updatedAt: eventDoc?.updatedAt,
    };
};

export const createCalendarEvent = async (req, res) => {
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
        const endTime = asTrimmedString(req.body.endTime);
        const venue = asTrimmedString(req.body.venue);
        const address = asTrimmedString(req.body.address);
        const onlineEvent = parseBooleanField(req.body.onlineEvent);
        const ticketType = asTrimmedString(req.body.ticketType) || "prepaid";
        const freeEvent = parseBooleanField(req.body.freeEvent);
        const fixedPrice = parseBooleanField(req.body.fixedPrice);
        const currency = asTrimmedString(req.body.currency) || "GBP";
        const parsedTicketLink = parseOptionalUrlField(req.body.ticketLink);
        const ticketLink = parsedTicketLink.value;
        const allowResell = asTrimmedString(req.body.allowResell) || "yes";
        const resellCondition = asTrimmedString(req.body.resellCondition) || "When tickets are sold-out";
        const minPrice = freeEvent ? 0 : parseNumericField(req.body.minPrice);
        const maxPrice = freeEvent ? 0 : parseNumericField(req.body.maxPrice);

        const parsedInstagram = parseOptionalUrlField(req.body.instagram);
        const parsedFacebook = parseOptionalUrlField(req.body.facebook);
        const parsedYouTube = parseOptionalUrlField(req.body.youtube);
        const parsedLinkedin = parseOptionalUrlField(req.body.linkedin);
        const parsedWebsite = parseOptionalUrlField(req.body.website);

        const socialLinks = {
            instagram: parsedInstagram.value,
            facebook: parsedFacebook.value,
            youtube: parsedYouTube.value,
            linkedin: parsedLinkedin.value,
            website: parsedWebsite.value,
        };

        if (!title) {
            return res.status(400).json({ success: false, message: "Title is required" });
        }

        if (!description) {
            return res.status(400).json({ success: false, message: "Description is required" });
        }

        if (!parsedTicketLink.isValid) {
            return res.status(400).json({ success: false, message: "Ticket link must be a valid URL" });
        }

        if (!parsedInstagram.isValid || !parsedFacebook.isValid || !parsedYouTube.isValid || !parsedLinkedin.isValid || !parsedWebsite.isValid) {
            return res.status(400).json({ success: false, message: "One or more social links are invalid" });
        }

        if (!address) {
            return res.status(400).json({ success: false, message: "Address is required" });
        }

        if (!validateDate(startDate)) {
            return res.status(400).json({ success: false, message: "Start date is invalid" });
        }

        if (!validateTime(startTime)) {
            return res.status(400).json({ success: false, message: "Start time is invalid" });
        }

        if (endTime && !validateTime(endTime)) {
            return res.status(400).json({ success: false, message: "End time is invalid" });
        }

        if (endTime && `${startDate}T${endTime}` <= `${startDate}T${startTime}`) {
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

        if (!CURRENCIES.includes(currency)) {
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

        const event = await CalendarEvent.create({
            createdBy: user._id,
            eventType,
            title,
            description,
            genres,
            musicFormat,
            startDate,
            startTime,
            endTime,
            venue,
            address,
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
            socialLinks,
            coHosts: asTrimmedString(req.body.coHosts),
            imageUrl: req.file ? `/uploads/events/${req.file.filename}` : "",
        });

        const activityLine = buildActivityLine(title, startDate, startTime);
        const activityItem = {
            type: "event.created",
            entityType: "event",
            entityId: event._id,
            message: activityLine,
            createdAt: new Date(),
        };
        await upsertProfileActivity(user, activityItem);

        return res.status(201).json({
            success: true,
            message: "Event created successfully",
            event: toClientEvent({ ...event.toObject(), createdBy: user }, user._id),
            activityLine,
            activityItem,
        });
    } catch (error) {
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
            .lean();

        return res.status(200).json({
            success: true,
            events: events.map((item) => toClientEvent(item, user._id)),
        });
    } catch (error) {
        console.log("Error in listCalendarEvents", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const updateCalendarEvent = async (req, res) => {
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
            "eventType", "title", "description", "musicFormat", "startDate", "startTime", "endTime", "venue", "address",
            "onlineEvent", "ticketType", "freeEvent", "fixedPrice", "currency", "ticketLink", "allowResell", "resellCondition", "coHosts",
            "instagram", "facebook", "youtube", "linkedin", "website", "genres", "minPrice", "maxPrice",
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
            endTime: updates.endTime ?? event.endTime,
            venue: updates.venue ?? event.venue,
            address: updates.address ?? event.address,
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
            instagram: updates.instagram ?? event.socialLinks?.instagram,
            facebook: updates.facebook ?? event.socialLinks?.facebook,
            youtube: updates.youtube ?? event.socialLinks?.youtube,
            linkedin: updates.linkedin ?? event.socialLinks?.linkedin,
            website: updates.website ?? event.socialLinks?.website,
            coHosts: updates.coHosts ?? event.coHosts,
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
        const normalizedCurrency = asTrimmedString(req.body.currency);
        const normalizedAllowResell = asTrimmedString(req.body.allowResell);
        const normalizedResellCondition = asTrimmedString(req.body.resellCondition);
        const normalizedStartDate = asTrimmedString(req.body.startDate);
        const normalizedStartTime = asTrimmedString(req.body.startTime);
        const normalizedEndTime = asTrimmedString(req.body.endTime);

        if (!EVENT_TYPES.includes(normalizedEventType) || !MUSIC_FORMATS.includes(normalizedMusicFormat) || !TICKET_TYPES.includes(normalizedTicketType) || !CURRENCIES.includes(normalizedCurrency)) {
            return res.status(400).json({ success: false, message: "One or more event option values are invalid" });
        }

        if (!["yes", "no"].includes(normalizedAllowResell)) {
            return res.status(400).json({ success: false, message: "Allow re-sell value is invalid" });
        }

        if (normalizedAllowResell === "yes" && !RESALE_OPTIONS.includes(normalizedResellCondition)) {
            return res.status(400).json({ success: false, message: "Re-sell condition is invalid" });
        }

        if (!validateDate(normalizedStartDate) || !validateTime(normalizedStartTime) || (normalizedEndTime && !validateTime(normalizedEndTime))) {
            return res.status(400).json({ success: false, message: "Date or time values are invalid" });
        }

        if (normalizedEndTime && `${normalizedStartDate}T${normalizedEndTime}` <= `${normalizedStartDate}T${normalizedStartTime}`) {
            return res.status(400).json({ success: false, message: "End time must be after start time" });
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
        event.description = asTrimmedString(req.body.description);
        event.genres = parsedGenres;
        event.musicFormat = normalizedMusicFormat;
        event.startDate = normalizedStartDate;
        event.startTime = normalizedStartTime;
        event.endTime = normalizedEndTime;
        event.venue = asTrimmedString(req.body.venue);
        event.address = asTrimmedString(req.body.address);
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
        event.socialLinks = {
            instagram: parsedInstagram.value,
            facebook: parsedFacebook.value,
            youtube: parsedYouTube.value,
            linkedin: parsedLinkedin.value,
            website: parsedWebsite.value,
        };
        event.coHosts = asTrimmedString(req.body.coHosts);

        if (req.file) {
            event.imageUrl = `/uploads/events/${req.file.filename}`;
        }

        await event.save();
        await upsertProfileActivity(user, {
            type: "event.updated",
            entityType: "event",
            entityId: event._id,
            message: `Updated event: ${event.title}`,
            createdAt: new Date(),
        });

        const populated = await CalendarEvent.findById(event._id).populate("createdBy", "firstName lastName email role").lean();
        return res.status(200).json({
            success: true,
            message: "Event updated successfully",
            event: toClientEvent(populated, user._id),
        });
    } catch (error) {
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

        if (!canManageEvent(user, event)) {
            return res.status(403).json({ success: false, message: "Only event owners can delete events" });
        }

        await CalendarEvent.findByIdAndDelete(event._id);
        await removeEventActivityFromProfile(user._id, event._id);

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

                return {
                    id: placeId || `${formatted}-${index}`,
                    placeId,
                    primaryText: line1 || formatted,
                    secondaryText: line2,
                    description: formatted || [line1, line2].filter(Boolean).join(", "),
                };
            })
            .filter((item) => item.description);

        return res.status(200).json({ success: true, suggestions });
    } catch (error) {
        console.log("Error in autocompletePlaces", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
