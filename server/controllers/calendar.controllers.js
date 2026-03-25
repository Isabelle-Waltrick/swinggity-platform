import { CalendarEvent } from "../models/calendarEvent.model.js";
import { User } from "../models/user.model.js";
import { Profile } from "../models/profile.model.js";

const EVENT_TYPES = ["Social", "Class", "Workshop", "Festival"];
const MUSIC_FORMATS = ["All", "DJ", "Live music"];
const TICKET_TYPES = ["prepaid", "door"];
const CURRENCIES = ["GBP", "EUR", "USD"];
const RESALE_OPTIONS = ["When tickets are sold-out", "Always"];
const ALLOWED_ROLES = ["organiser", "admin"];

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

const validateTime = (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
const validateDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const buildActivityLine = (title, startDate, startTime) => {
    const date = asTrimmedString(startDate);
    const time = asTrimmedString(startTime);
    return `Created event: ${title} (${date} ${time})`;
};

export const createCalendarEvent = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!ALLOWED_ROLES.includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: "Only users with organiser or admin role can create events",
            });
        }

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

        const profile = await Profile.findOne({ user: user._id });
        const activityLine = buildActivityLine(title, startDate, startTime);

        if (profile) {
            const current = asTrimmedString(profile.activity);
            profile.activity = current ? `${activityLine}\n${current}`.slice(0, 1000) : activityLine.slice(0, 1000);
            await profile.save();
        } else {
            await Profile.create({
                user: user._id,
                displayFirstName: user.firstName,
                displayLastName: user.lastName,
                activity: activityLine.slice(0, 1000),
            });
        }

        return res.status(201).json({
            success: true,
            message: "Event created successfully",
            event,
            activityLine,
        });
    } catch (error) {
        console.log("Error in createCalendarEvent", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
