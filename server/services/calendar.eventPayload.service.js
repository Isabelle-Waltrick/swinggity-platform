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

export const pickProvidedEventUpdates = (body = {}) => {
    const updates = {};
    for (const field of EVENT_UPDATABLE_FIELDS) {
        if (body[field] !== undefined) {
            updates[field] = body[field];
        }
    }
    return updates;
};

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

export const normalizeAndValidateEventInput = ({ body, mode }) => {
    const parsedGenres = parseGenres(body.genres);
    const parsedInstagram = parseOptionalUrlField(body.instagram);
    const parsedFacebook = parseOptionalUrlField(body.facebook);
    const parsedYouTube = parseOptionalUrlField(body.youtube);
    const parsedLinkedin = parseOptionalUrlField(body.linkedin);
    const parsedWebsite = parseOptionalUrlField(body.website);
    const parsedTicketLink = parseOptionalUrlField(body.ticketLink);

    if (!parsedInstagram.isValid || !parsedFacebook.isValid || !parsedYouTube.isValid || !parsedLinkedin.isValid || !parsedWebsite.isValid || !parsedTicketLink.isValid) {
        return { success: false, status: 400, message: mode === "create" ? "One or more online links are invalid" : "One or more links are invalid" };
    }

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

    if (mode === "create" && !title) {
        return { success: false, status: 400, message: "Title is required" };
    }

    if (!description) {
        return { success: false, status: 400, message: "Description is required" };
    }

    if (description.length > EVENT_DESCRIPTION_MAX_LENGTH) {
        return {
            success: false,
            status: 400,
            message: `Description must be ${EVENT_DESCRIPTION_MAX_LENGTH} characters or fewer`,
        };
    }

    if (mode === "create" && !address) {
        return { success: false, status: 400, message: "Address is required" };
    }

    if (!validateDate(startDate)) {
        return {
            success: false,
            status: 400,
            message: mode === "create" ? "Start date is invalid" : "Date or time values are invalid",
        };
    }

    if (!validateQuarterHourTime(startTime)) {
        return {
            success: false,
            status: 400,
            message: mode === "create" ? "Start time is invalid. Use 15-minute increments." : "Date or time values are invalid",
        };
    }

    if (hasEndDateTime && (!endDate || !endTime)) {
        return { success: false, status: 400, message: "Both end date and end time are required" };
    }

    if (endDate && !validateDate(endDate)) {
        return { success: false, status: 400, message: "End date is invalid" };
    }

    if (endDate && endDate < startDate) {
        return { success: false, status: 400, message: "End date cannot be before start date" };
    }

    if (endTime && !validateQuarterHourTime(endTime)) {
        return {
            success: false,
            status: 400,
            message: mode === "create" ? "End time is invalid. Use 15-minute increments." : "Date or time values are invalid",
        };
    }

    if (endDate && endTime && `${endDate}T${endTime}` <= `${startDate}T${startTime}`) {
        return { success: false, status: 400, message: "End time must be after start time" };
    }

    if (!EVENT_TYPES.includes(eventType)) {
        return { success: false, status: 400, message: mode === "create" ? "Event type is invalid" : "One or more event option values are invalid" };
    }

    if (!MUSIC_FORMATS.includes(musicFormat)) {
        return { success: false, status: 400, message: mode === "create" ? "Music format is invalid" : "One or more event option values are invalid" };
    }

    if (!TICKET_TYPES.includes(ticketType)) {
        return { success: false, status: 400, message: mode === "create" ? "Ticket type is invalid" : "One or more event option values are invalid" };
    }

    if (!isValidCurrencyCode(currency)) {
        return { success: false, status: 400, message: mode === "create" ? "Currency is invalid" : "One or more event option values are invalid" };
    }

    if (!["yes", "no"].includes(allowResell)) {
        return { success: false, status: 400, message: "Allow re-sell value is invalid" };
    }

    if (allowResell === "yes" && !RESALE_OPTIONS.includes(resellCondition)) {
        return { success: false, status: 400, message: "Re-sell condition is invalid" };
    }

    if (!freeEvent) {
        if (!Number.isFinite(minPrice) || minPrice < 0) {
            return {
                success: false,
                status: 400,
                message: mode === "create"
                    ? "Minimum price must be a number greater than or equal to 0"
                    : "Price fields must be numbers greater than or equal to 0",
            };
        }

        if (!Number.isFinite(maxPrice) || maxPrice < 0) {
            return {
                success: false,
                status: 400,
                message: mode === "create"
                    ? "Maximum price must be a number greater than or equal to 0"
                    : "Price fields must be numbers greater than or equal to 0",
            };
        }

        if (fixedPrice && minPrice !== maxPrice) {
            return {
                success: false,
                status: 400,
                message: mode === "create"
                    ? "Fixed price events must have the same minimum and maximum price"
                    : "Fixed price events must have matching min and max price",
            };
        }

        if (!fixedPrice && maxPrice < minPrice) {
            return { success: false, status: 400, message: "Maximum price must be greater than or equal to minimum price" };
        }
    }

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

export const resolvePublisherSelection = async ({
    user,
    isAdminUser,
    publisherTypeInput,
    publisherOrganisationIdInput,
    defaultPublisherType = "member",
    defaultPublisherOrganisationId = null,
}) => {
    const publisherType = asTrimmedString(publisherTypeInput) || defaultPublisherType;
    const publisherOrganisationId = asTrimmedString(publisherOrganisationIdInput);

    let validatedPublisherType = defaultPublisherType;
    let validatedPublisherOrganisationId = defaultPublisherOrganisationId;

    if (publisherType === "organisation" && publisherOrganisationId) {
        const organisation = await Organisation.findById(publisherOrganisationId);
        if (!organisation) {
            return { success: false, status: 400, message: "Organisation not found" };
        }

        if (!isAdminUser && !canUserPublishForOrganisation(organisation, user._id)) {
            return {
                success: false,
                status: 403,
                message: "You can only publish events under organisations you belong to",
            };
        }

        validatedPublisherType = "organisation";
        validatedPublisherOrganisationId = organisation._id;
    } else if (publisherType === "member") {
        validatedPublisherType = "member";
        validatedPublisherOrganisationId = null;
    }

    return {
        success: true,
        publisherType: validatedPublisherType,
        publisherOrganisationId: validatedPublisherOrganisationId,
    };
};
