import { CalendarEvent } from "../models/calendarEvent.model.js";
import { User } from "../models/user.model.js";
import { Profile } from "../models/profile.model.js";
import { Organisation } from "../models/organisation.model.js";
import mongoose from "mongoose";
import {
    canCreateOrManageEvents,
    canDeleteCalendarEvent,
    canMarkCalendarEventGoing,
    isAdminRole,
} from "../utils/rolePermissions.js";
import { getBaseCookieOptions } from "../utils/cookieOptions.js";
import {
    DEFAULT_RESALE_VISIBILITY,
    EVENT_DESCRIPTION_MAX_LENGTH,
    EVENT_TYPES,
    MUSIC_FORMATS,
    RESALE_OPTIONS,
    RESALE_TICKETS_MAX,
    TICKET_TYPES,
} from "../constants/calendar.constants.js";
import {
    asTrimmedString,
    buildCoHostContactKey,
    buildCoHostsTextFromContacts,
    buildUserDisplayName,
    canUserPublishForOrganisation,
    getIdSet,
    inferCityFromAddress,
    isResellOpenForEvent,
    isValidCurrencyCode,
    isValidObjectIdString,
    normalizeAttendeeAvatar,
    normalizeCurrencyCode,
    normalizeMusicFormat,
    normalizeResaleVisibility,
    parseBooleanField,
    parseCoHostSelection,
    parseGenres,
    parseNumericField,
    parseOptionalUrlField,
    parseRemovedCoHostKeys,
    validateDate,
    validateQuarterHourTime,
} from "../validators/calendar.validators.js";
import { toClientEvent } from "../serializers/calendar.serializer.js";
import { deleteEventImageAsset, storeEventImageAsset } from "../services/calendar.media.service.js";
import { appendCoHostInvitation } from "../services/calendar.cohost.service.js";

/**
 * buildActivityLine: handles this function's core responsibility.
 */
const buildActivityLine = (title, startDate, startTime) => {
    // Guard clauses and normalization keep request handling predictable.
    const date = asTrimmedString(startDate);
    const time = asTrimmedString(startTime);
    return `Created event: ${title} (${date} ${time})`;
};

/**
 * findUserOrReject: handles this function's core responsibility.
 */
const findUserOrReject = async (userId, res) => {
    // Guard clauses and normalization keep request handling predictable.
    const user = await User.findById(userId);
    if (!user) {
        res.clearCookie("token", getBaseCookieOptions());
        res.status(401).json({ success: false, message: "Session expired. Please log in again." });
        return null;
    }
    return user;
};

/**
 * ensureEventPosterRole: handles this function's core responsibility.
 */
const ensureEventPosterRole = (user, res) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!canCreateOrManageEvents(user?.role)) {
        res.status(403).json({
            success: false,
            message: "Only users with organiser or admin role can create or manage events",
        });
        return false;
    }
    return true;
};

/**
 * canManageEvent: handles this function's core responsibility.
 */
const canManageEvent = (user, event) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!user || !event) return false;
    const createdById = String(event?.createdBy?._id || event?.createdBy || "");
    const isOwner = createdById === String(user._id || "");
    return isOwner;
};

/**
 * normalizeLegacyActivity: handles this function's core responsibility.
 */
const normalizeLegacyActivity = (activityText) => {
    // Guard clauses and normalization keep request handling predictable.
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

/**
 * dedupeProfileActivityFeed: handles this function's core responsibility.
 */
const dedupeProfileActivityFeed = (feed, entityType, entityId) => {
    // Guard clauses and normalization keep request handling predictable.
    const normalizedEntityType = asTrimmedString(entityType);
    const normalizedEntityId = String(entityId || "").trim();

    if (!normalizedEntityType || !normalizedEntityId) {
        return Array.isArray(feed) ? feed : [];
    }

    return (Array.isArray(feed) ? feed : []).filter((item) => !(
        asTrimmedString(item?.entityType) === normalizedEntityType
        && String(item?.entityId || "").trim() === normalizedEntityId
    ));
};

/**
 * upsertProfileActivity: handles this function's core responsibility.
 */
const upsertProfileActivity = async (user, activityItem) => {
    // Guard clauses and normalization keep request handling predictable.
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

    const nextFeed = [
        normalizedActivityItem,
        ...dedupeProfileActivityFeed(existingFeed, normalizedActivityItem.entityType, normalizedActivityItem.entityId),
    ].slice(0, 30);
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

/**
 * removeEventActivityFromProfile: handles this function's core responsibility.
 */
const removeEventActivityFromProfile = async (userId, eventId) => {
    // Guard clauses and normalization keep request handling predictable.
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

/**
 * getProfileAvatarByUserId: handles this function's core responsibility.
 */
const getProfileAvatarByUserId = async (userId) => {
    // Guard clauses and normalization keep request handling predictable.
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId || !mongoose.Types.ObjectId.isValid(normalizedUserId)) return "";

    const profile = await Profile.findOne({ user: normalizedUserId }).select("avatarUrl").lean();
    return normalizeAttendeeAvatar(profile?.avatarUrl);
};

/**
 * getProfileDisplayNameByUserId: handles this function's core responsibility.
 */
const getProfileDisplayNameByUserId = async (userId) => {
    // Guard clauses and normalization keep request handling predictable.
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId || !mongoose.Types.ObjectId.isValid(normalizedUserId)) return "";

    const profile = await Profile.findOne({ user: normalizedUserId })
        .select("displayFirstName displayLastName")
        .lean();

    return buildUserDisplayName(profile?.displayFirstName, profile?.displayLastName, "");
};

/**
 * getProfileAvatarMapByUserIds: handles this function's core responsibility.
 */
const getProfileAvatarMapByUserIds = async (userIds) => {
    // Guard clauses and normalization keep request handling predictable.
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

/**
 * getProfileDisplayNameMapByUserIds: handles this function's core responsibility.
 */
const getProfileDisplayNameMapByUserIds = async (userIds) => {
    // Guard clauses and normalization keep request handling predictable.
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

/**
 * getProfileJamCircleSetMapByUserIds: handles this function's core responsibility.
 */
const getProfileJamCircleSetMapByUserIds = async (userIds) => {
    // Guard clauses and normalization keep request handling predictable.
    const normalizedUserIds = [...new Set(
        (Array.isArray(userIds) ? userIds : [])
            .map((userId) => String(userId || "").trim())
            .filter((userId) => userId && mongoose.Types.ObjectId.isValid(userId))
    )];

    if (normalizedUserIds.length === 0) return {};

    const profiles = await Profile.find({ user: { $in: normalizedUserIds } })
        .select("user jamCircleMembers")
        .lean();

    return profiles.reduce((accumulator, profile) => {
        const ownerId = String(profile?.user || "").trim();
        if (!ownerId) return accumulator;
        accumulator[ownerId] = getIdSet(profile?.jamCircleMembers);
        return accumulator;
    }, {});
};

/**
 * getOrganisationSummaryMapByIds: handles this function's core responsibility.
 */
const getOrganisationSummaryMapByIds = async (organisationIds) => {
    // Guard clauses and normalization keep request handling predictable.
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

/**
 * createCalendarEvent: handles this function's core responsibility.
 */
export const createCalendarEvent = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
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
        const musicFormat = normalizeMusicFormat(req.body.musicFormat) || "Both";
        const startDate = asTrimmedString(req.body.startDate);
        const startTime = asTrimmedString(req.body.startTime);
        const endDateInput = asTrimmedString(req.body.endDate);
        const endTime = asTrimmedString(req.body.endTime);
        const hasEndDateTime = Boolean(endDateInput || endTime);
        const endDate = hasEndDateTime ? (endDateInput || startDate) : "";
        const venue = asTrimmedString(req.body.venue);
        const address = asTrimmedString(req.body.address);
        const cityInput = asTrimmedString(req.body.city);
        /**
         * city: handles this function's core responsibility.
         */
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
            editedAt: null,
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

/**
 * listCalendarEvents: handles this function's core responsibility.
 */
export const listCalendarEvents = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const userId = req.userId;
        const user = await findUserOrReject(userId, res);
        if (!user) return;

        const events = await CalendarEvent.find({})
            .sort({ startDate: 1, startTime: 1, createdAt: -1 })
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email")
            .lean();

        const viewerProfile = await Profile.findOne({ user: user._id }).select("jamCircleMembers").lean();
        const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
        const canViewAllAttendees = isAdminRole(user.role);

        const profileUserIds = events.flatMap((item) => {
            const organizerId = String(item?.createdBy?._id || item?.createdBy || "");
            const attendeeIds = Array.isArray(item?.attendees)
                ? item.attendees.map((attendee) => String(attendee?.user?._id || attendee?.user || ""))
                : [];
            return [organizerId, ...attendeeIds];
        });

        const organizerAvatarMap = await getProfileAvatarMapByUserIds(profileUserIds);
        const displayNameMap = await getProfileDisplayNameMapByUserIds(profileUserIds);
        const attendeeCircleSetMap = await getProfileJamCircleSetMapByUserIds(profileUserIds);
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
                    attendeeCircleSetMap,
                    coHostOrganisationMap: organisationSummaryMap,
                    publisherOrganisationMap: organisationSummaryMap,
                    viewerCircleSet,
                    canViewAllAttendees,
                });
            }),
        });
    } catch (error) {
        console.log("Error in listCalendarEvents", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * getCalendarEventById: handles this function's core responsibility.
 */
export const getCalendarEventById = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
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

        const viewerProfile = await Profile.findOne({ user: user._id }).select("jamCircleMembers").lean();
        const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
        const canViewAllAttendees = isAdminRole(user.role);

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
        const attendeeCircleSetMap = await getProfileJamCircleSetMapByUserIds(profileUserIds);
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
                attendeeCircleSetMap,
                coHostOrganisationMap: organisationSummaryMap,
                publisherOrganisationMap: organisationSummaryMap,
                viewerCircleSet,
                canViewAllAttendees,
            }),
        });
    } catch (error) {
        console.log("Error in getCalendarEventById", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * updateCalendarEvent: handles this function's core responsibility.
 */
export const updateCalendarEvent = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
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
        const normalizedMusicFormat = normalizeMusicFormat(req.body.musicFormat);
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
        /**
         * normalizedCity: handles this function's core responsibility.
         */
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

        event.editedAt = new Date();

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
        const attendeeCircleSetMap = await getProfileJamCircleSetMapByUserIds(profileUserIds);
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
                attendeeCircleSetMap,
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

/**
 * deleteCalendarEvent: handles this function's core responsibility.
 */
export const deleteCalendarEvent = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
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

        if (!canDeleteCalendarEvent({ role: user.role, isEventOwner: canManageEvent(user, event) })) {
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

/**
 * markCalendarEventGoing: handles this function's core responsibility.
 */
export const markCalendarEventGoing = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const { eventId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(String(eventId || ""))) {
            return res.status(400).json({ success: false, message: "Invalid event id" });
        }

        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        if (!canMarkCalendarEventGoing(user.role)) {
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
                resaleVisibility: DEFAULT_RESALE_VISIBILITY,
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
        const attendeeCircleSetMap = await getProfileJamCircleSetMapByUserIds(profileUserIds);
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
                attendeeCircleSetMap,
                coHostOrganisationMap: organisationSummaryMap,
                publisherOrganisationMap: organisationSummaryMap,
            }),
        });
    } catch (error) {
        console.log("Error in markCalendarEventGoing", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * updateCalendarEventResellAvailability: handles this function's core responsibility.
 */
export const updateCalendarEventResellAvailability = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
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
        const attendeeCircleSetMap = await getProfileJamCircleSetMapByUserIds(profileUserIds);
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
                attendeeCircleSetMap,
                coHostOrganisationMap: organisationSummaryMap,
                publisherOrganisationMap: organisationSummaryMap,
            }),
        });
    } catch (error) {
        console.log("Error in updateCalendarEventResellAvailability", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * updateCalendarEventResellTickets: handles this function's core responsibility.
 */
export const updateCalendarEventResellTickets = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
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
        const resaleVisibility = normalizeResaleVisibility(req.body.resaleVisibility);

        const profileAvatarUrl = rawTicketCount > 0 ? await getProfileAvatarByUserId(user._id) : "";

        const attendeeIndex = Array.isArray(event.attendees)
            ? event.attendees.findIndex((attendee) => String(attendee?.user?._id || attendee?.user || "") === String(user._id))
            : -1;

        if (attendeeIndex < 0 && rawTicketCount > 0) {
            event.attendees.push({
                user: user._id,
                avatarUrl: profileAvatarUrl,
                resaleTicketCount: rawTicketCount,
                resaleVisibility,
            });
        } else if (attendeeIndex >= 0) {
            event.attendees[attendeeIndex].resaleTicketCount = rawTicketCount;
            event.attendees[attendeeIndex].resaleVisibility = resaleVisibility;

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
        const attendeeCircleSetMap = await getProfileJamCircleSetMapByUserIds(profileUserIds);
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
                attendeeCircleSetMap,
                coHostOrganisationMap: organisationSummaryMap,
                publisherOrganisationMap: organisationSummaryMap,
            }),
        });
    } catch (error) {
        console.log("Error in updateCalendarEventResellTickets", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};


