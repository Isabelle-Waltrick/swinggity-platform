// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Event Payload Service Guide
 * This service prepares and validates event payloads for create/update flows.
 * It merges partial updates, normalizes fields, and enforces business constraints.
 * This keeps controller files focused on orchestration instead of data plumbing.
 */

import { Organisation } from "../models/organisation.model.js";
import {
    EVENT_DESCRIPTION_MAX_LENGTH,
    EVENT_TYPES,
    MUSIC_FORMATS,
    RESALE_OPTIONS,
    TICKET_TYPES,
} from "../constants/calendar.constants.js";
import {
    asTrimmedString,
    canUserPublishForOrganisation,
    inferCityFromAddress,
    isValidCurrencyCode,
    normalizeCurrencyCode,
    normalizeMusicFormat,
    parseBooleanField,
    parseGenres,
    parseNumericField,
    parseOptionalUrlField,
    validateDate,
    validateQuarterHourTime,
} from "../validators/calendar.utils.js";

export const EVENT_UPDATABLE_FIELDS = [
    "eventType", "title", "description", "musicFormat", "startDate", "startTime", "endDate", "endTime", "venue", "address", "city",
    "onlineEvent", "ticketType", "freeEvent", "fixedPrice", "currency", "ticketLink", "allowResell", "resellCondition", "coHosts",
    "coHostUserId", "coHostType", "coHostOrganisationId", "coHostDisplayName",
    "removedCoHostKeys",
    "instagram", "facebook", "youtube", "linkedin", "website", "genres", "minPrice", "maxPrice",
    "publisherType", "publisherOrganisationId",
];

/**
 * pickProvidedEventUpdates:
 * Copies only explicitly provided, allowlisted update fields from request body.
 */
export const pickProvidedEventUpdates = (body = {}) => {
    const updates = {};
    // Keep partial updates predictable by ignoring unknown or undefined fields.
    for (const field of EVENT_UPDATABLE_FIELDS) {
        if (body[field] !== undefined) {
            updates[field] = body[field];
        }
    }
    return updates;
};

/**
 * buildMergedEventUpdateBody:
 * Produces a full event-shaped payload by merging incoming updates over the
 * current persisted event values.
 */
export const buildMergedEventUpdateBody = ({ event, updates }) => ({
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
});

/**
 * normalizeAndValidateEventInput:
 * Normalizes create/update payloads and enforces calendar business rules.
 */
export const normalizeAndValidateEventInput = ({ body, mode }) => {
    // Parse all optional URL fields up front so one validation branch can cover them.
    const parsedGenres = parseGenres(body.genres);
    const parsedInstagram = parseOptionalUrlField(body.instagram);
    const parsedFacebook = parseOptionalUrlField(body.facebook);
    const parsedYouTube = parseOptionalUrlField(body.youtube);
    const parsedLinkedin = parseOptionalUrlField(body.linkedin);
    const parsedWebsite = parseOptionalUrlField(body.website);
    const parsedTicketLink = parseOptionalUrlField(body.ticketLink);

    // Reject early when any link is malformed.
    if (!parsedInstagram.isValid || !parsedFacebook.isValid || !parsedYouTube.isValid || !parsedLinkedin.isValid || !parsedWebsite.isValid || !parsedTicketLink.isValid) {
        return { success: false, status: 400, message: mode === "create" ? "One or more online links are invalid" : "One or more links are invalid" };
    }

    // Normalize/derive fields into a consistent internal shape before rule checks.
    const eventType = asTrimmedString(body.eventType) || "Social";
    const title = asTrimmedString(body.title);
    const description = asTrimmedString(body.description);
    const musicFormat = normalizeMusicFormat(body.musicFormat) || "Both";
    const startDate = asTrimmedString(body.startDate);
    const startTime = asTrimmedString(body.startTime);
    const endDateInput = asTrimmedString(body.endDate);
    const endTime = asTrimmedString(body.endTime);
    const hasEndDateTime = Boolean(endDateInput || endTime);
    const endDate = hasEndDateTime ? (endDateInput || startDate) : "";
    const venue = asTrimmedString(body.venue);
    const address = asTrimmedString(body.address);
    const cityInput = asTrimmedString(body.city);
    const city = (cityInput || inferCityFromAddress(address)).slice(0, 120);
    const onlineEvent = parseBooleanField(body.onlineEvent);
    const ticketType = asTrimmedString(body.ticketType) || "prepaid";
    const freeEvent = parseBooleanField(body.freeEvent);
    const fixedPrice = parseBooleanField(body.fixedPrice);
    const currency = normalizeCurrencyCode(body.currency) || "GBP";
    const ticketLink = parsedTicketLink.value;
    const allowResell = asTrimmedString(body.allowResell) || "no";
    const resellCondition = asTrimmedString(body.resellCondition) || "When tickets are sold-out";
    const minPrice = freeEvent ? 0 : parseNumericField(body.minPrice);
    const maxPrice = freeEvent ? 0 : parseNumericField(body.maxPrice);

    // Create mode requires title; update mode may send partial title changes via merged payload.
    if (mode === "create" && !title) {
        return { success: false, status: 400, message: "Title is required" };
    }
    // Description is required for both create and update flows
    if (!description) {
        return { success: false, status: 400, message: "Description is required" };
    }
    // Enforce description length limit even in updates to prevent excessively long persisted values.
    if (description.length > EVENT_DESCRIPTION_MAX_LENGTH) {
        return {
            success: false, status: 400,
            message: `Description must be ${EVENT_DESCRIPTION_MAX_LENGTH} characters or fewer`,
        };
    }
    // Venue and address are required for in-person events; city is required for all events.
    if (mode === "create" && !address) {
        return { success: false, status: 400, message: "Address is required" };
    }
    // Validate date/time semantics before option/value constraints.
    if (!validateDate(startDate)) {
        return {
            success: false, status: 400,
            message: mode === "create" ? "Start date is invalid" : "Date or time values are invalid",
        };
    }
    // Start time is required for create and update flows to prevent accidental all-day events via merged payloads.
    if (!validateQuarterHourTime(startTime)) {
        return {
            success: false, status: 400,
            message: mode === "create" ? "Start time is invalid. Use 15-minute increments." : "Date or time values are invalid",
        };
    }
    // If one of end date or time is provided, require both to ensure consistent semantics and simplify client logic.
    if (hasEndDateTime && (!endDate || !endTime)) {
        return { success: false, status: 400, message: "Both end date and end time are required" };
    }
    // End date cannot be before start date; end datetime must be after start datetime.
    if (endDate && !validateDate(endDate)) {
        return { success: false, status: 400, message: "End date is invalid" };
    }
    // End date can be the same as start date, but not before. Time validation ensures consistent comparison format.
    if (endDate && endDate < startDate) {
        return { success: false, status: 400, message: "End date cannot be before start date" };
    }
    // If end time is provided, end date must be provided and end datetime must be after start datetime.
    if (endTime && !validateQuarterHourTime(endTime)) {
        return {
            success: false, status: 400,
            message: mode === "create" ? "End time is invalid. Use 15-minute increments." : "Date or time values are invalid",
        };
    }
    // If end date and time are provided, end datetime must be after start datetime.
    if (endDate && endTime && `${endDate}T${endTime}` <= `${startDate}T${startTime}`) {
        return { success: false, status: 400, message: "End time must be after start time" };
    }

    // EVENT TYPE must match one of the supported calendar event categories.
    if (!EVENT_TYPES.includes(eventType)) {
        return { success: false, status: 400, message: mode === "create" ? "Event type is invalid" : "One or more event option values are invalid" };
    }
    // MUSIC FORMAT must be one of the allowed enum values (Both, DJ, Live music).
    if (!MUSIC_FORMATS.includes(musicFormat)) {
        return { success: false, status: 400, message: mode === "create" ? "Music format is invalid" : "One or more event option values are invalid" };
    }
    // TICKET TYPE must be a supported option for checkout/resale flows.
    if (!TICKET_TYPES.includes(ticketType)) {
        return { success: false, status: 400, message: mode === "create" ? "Ticket type is invalid" : "One or more event option values are invalid" };
    }
    // CURRENCY code must be a valid normalized ISO-style currency value.
    if (!isValidCurrencyCode(currency)) {
        return { success: false, status: 400, message: mode === "create" ? "Currency is invalid" : "One or more event option values are invalid" };
    }
    // ALLOW RE-SELL accepts only explicit yes/no values.
    if (!["yes", "no"].includes(allowResell)) {
        return { success: false, status: 400, message: "Allow re-sell value is invalid" };
    }
    // RESALE CONDITION is required and constrained only when resale is enabled.
    if (allowResell === "yes" && !RESALE_OPTIONS.includes(resellCondition)) {
        return { success: false, status: 400, message: "Re-sell condition is invalid" };
    }

    // Price rules apply only when event is not free.
    if (!freeEvent) {
        // MIN PRICE must be numeric and non-negative for paid events.
        if (!Number.isFinite(minPrice) || minPrice < 0) {
            return {
                success: false,
                status: 400,
                message: mode === "create"
                    ? "Minimum price must be a number greater than or equal to 0"
                    : "Price fields must be numbers greater than or equal to 0",
            };
        }
        // MAX PRICE must be numeric and non-negative for paid events.
        if (!Number.isFinite(maxPrice) || maxPrice < 0) {
            return {
                success: false,
                status: 400,
                message: mode === "create"
                    ? "Maximum price must be a number greater than or equal to 0"
                    : "Price fields must be numbers greater than or equal to 0",
            };
        }
        // FIXED PRICE events require min and max to be identical.
        if (fixedPrice && minPrice !== maxPrice) {
            return {
                success: false,
                status: 400,
                message: mode === "create"
                    ? "Fixed price events must have the same minimum and maximum price"
                    : "Fixed price events must have matching min and max price",
            };
        }
        // RANGE PRICE events require max to be greater than or equal to min.
        if (!fixedPrice && maxPrice < minPrice) {
            return { success: false, status: 400, message: "Maximum price must be greater than or equal to minimum price" };
        }
    }
    // Return fully normalized payload used by create/update controllers.
    return {
        success: true,
        data: {
            eventType,
            title,
            description,
            genres: parsedGenres,
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
            resellCondition,
            onlineLinks: {
                instagram: parsedInstagram.value,
                facebook: parsedFacebook.value,
                youtube: parsedYouTube.value,
                linkedin: parsedLinkedin.value,
                website: parsedWebsite.value,
            },
        },
    };
};

/**
 * resolvePublisherSelection:
 * Resolves whether an event is published as member or organisation and verifies
 * organisation publish permissions for all users.
 */
export const resolvePublisherSelection = async ({
    user, isAdminUser,
    publisherTypeInput, publisherOrganisationIdInput,
    defaultPublisherType = "member", defaultPublisherOrganisationId = null,
}) => {

    // Normalize incoming publisher fields from request body (or merged update body).
    const publisherType = asTrimmedString(publisherTypeInput) || defaultPublisherType;
    const publisherOrganisationId = asTrimmedString(publisherOrganisationIdInput);
    // Start from defaults and override only after validation passes.
    let validatedPublisherType = defaultPublisherType;
    let validatedPublisherOrganisationId = defaultPublisherOrganisationId;
    // Organisation publishing requires a valid organisation and membership/ownership checks.
    if (publisherType === "organisation" && publisherOrganisationId) {
        // Confirm the referenced organisation actually exists before assigning publisher linkage.
        const organisation = await Organisation.findById(publisherOrganisationId);
        if (!organisation) {
            return { success: false, status: 400, message: "Organisation not found" };
        }
        // All users (including admins) may publish only for organisations they are allowed to represent.
        if (!canUserPublishForOrganisation(organisation, user._id)) {
            return {
                success: false, status: 403,
                message: "You can only publish events under organisations you belong to",
            };
        }
        // Validation passed: bind event publisher to organisation context.
        validatedPublisherType = "organisation";
        validatedPublisherOrganisationId = organisation._id;
        // Explicit member publish selection clears organisation binding.
    } else if (publisherType === "member") {
        // Member publishing always clears organisationId to avoid stale org linkage.
        validatedPublisherType = "member";
        validatedPublisherOrganisationId = null;
    }
    // Return normalized publisher fields that controllers can persist safely.
    return {
        success: true,
        publisherType: validatedPublisherType,
        publisherOrganisationId: validatedPublisherOrganisationId,
    };
};
