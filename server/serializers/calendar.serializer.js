// The code in this file were created with help of AI (Copilot)

/**
 * Calendar serializer.
 *
 * This module converts raw event documents into the stable client payload shape,
 * including viewer-aware attendee/reseller visibility and organizer presentation.
 */

import {
    asTrimmedString,
    buildUserDisplayName,
    canViewerSeeReseller,
    getIdSet,
    isResellOpenForEvent,
    normalizeAttendeeAvatar,
    normalizeResaleVisibility,
} from "../validators/calendar.utils.js";

/**
 * toClientEvent:
 * Serializes one calendar event document into the API payload consumed by the UI.
 */
export const toClientEvent = (eventDoc, currentUserId, options = {}) => {
    // Resolve host fields with safe fallbacks so partially populated docs still serialize.
    const host = eventDoc?.createdBy;
    const firstName = asTrimmedString(host?.firstName);
    const lastName = asTrimmedString(host?.lastName);

    // ORGANIZER DISPLAY NAME prioritizes precomputed context before local fallbacks.
    const fallbackOrganizerName = asTrimmedString(options?.organizerDisplayName) || `${firstName} ${lastName}`.trim() || host?.email || "Swinggity Host";

    // PUBLISHER TYPE drives whether organiser identity comes from member or organisation summary.
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

    // Keep CREATED BY fields explicit for ownership checks and profile-link rendering in the client.
    const createdById = String(host?._id || eventDoc?.createdBy || "");
    const createdByName = fallbackOrganizerName;
    const createdByAvatarUrl = normalizeAttendeeAvatar(options?.organizerAvatarUrl);

    // ORGANIZER AVATAR can come from organisation image when publisher is an organisation.
    const organizerAvatarUrl = publisherType === "organisation"
        ? normalizeAttendeeAvatar(publisherOrganisationSummary?.imageUrl) || normalizeAttendeeAvatar(options?.organizerAvatarUrl)
        : normalizeAttendeeAvatar(options?.organizerAvatarUrl);

    // Normalize optional lookup maps to avoid repeated null checks below.
    const attendeeDisplayNameMap = options?.attendeeDisplayNameMap && typeof options.attendeeDisplayNameMap === "object"
        ? options.attendeeDisplayNameMap
        : {};
    const coHostOrganisationMap = options?.coHostOrganisationMap && typeof options.coHostOrganisationMap === "object"
        ? options.coHostOrganisationMap
        : {};

    // Build the full attendee list first; visibility filtering happens in a separate step.
    const allAttendees = Array.isArray(eventDoc?.attendees)
        ? eventDoc.attendees
            .map((attendee) => {
                const attendeeUserId = String(attendee?.user?._id || attendee?.user || "");
                // ATTENDEE DISPLAY NAME prefers precomputed lookup values, then local user fields.
                const attendeeDisplayName = asTrimmedString(attendeeDisplayNameMap[attendeeUserId])
                    || buildUserDisplayName(attendee?.user?.firstName, attendee?.user?.lastName, attendee?.user?.email);

                return {
                    userId: attendeeUserId,
                    avatarUrl: normalizeAttendeeAvatar(attendee?.avatarUrl),
                    displayName: attendeeDisplayName,
                    resaleTicketCount: Number.isFinite(attendee?.resaleTicketCount) ? attendee.resaleTicketCount : 0,
                    resaleVisibility: normalizeResaleVisibility(attendee?.resaleVisibility),
                };
            })
            .filter((attendee) => attendee.userId)
        : [];
    // Derive viewer context once and reuse it for attendee/reseller visibility decisions.
    const normalizedCurrentUserId = String(currentUserId || "");
    const canViewAllAttendees = Boolean(options?.canViewAllAttendees);
    const isViewerAdmin = Boolean(options?.isViewerAdmin || canViewAllAttendees);
    const viewerCircleSet = options?.viewerCircleSet instanceof Set
        ? options.viewerCircleSet
        : getIdSet(options?.viewerCircleMemberIds);
    const attendeeCircleSetMap = options?.attendeeCircleSetMap && typeof options.attendeeCircleSetMap === "object"
        ? options.attendeeCircleSetMap
        : {};
    const isEventOwner = createdById === normalizedCurrentUserId;
    const rawMusicFormat = asTrimmedString(eventDoc?.musicFormat);
    // Keep LEGACY "All" values compatible by exposing them as "Both" in API responses.
    const normalizedMusicFormat = rawMusicFormat === "All" ? "Both" : (rawMusicFormat || "Both");
    // Non-admin viewers only see themselves plus members from their own circle set.
    const attendees = canViewAllAttendees
        ? allAttendees
        : allAttendees.filter((attendee) => (
            attendee.userId === normalizedCurrentUserId
            || viewerCircleSet.has(attendee.userId)
        ));
    // RESELLER list is filtered by ticket availability and per-viewer resale visibility rules.
    const resellers = allAttendees.filter((attendee) => {
        if (attendee.resaleTicketCount <= 0) return false;

        return canViewerSeeReseller({
            resellerUserId: attendee.userId,
            resaleVisibility: attendee.resaleVisibility,
            currentUserId: normalizedCurrentUserId,
            isViewerAdmin,
            isEventOwner,
            viewerCircleSet,
            resellerCircleSet: attendeeCircleSetMap[attendee.userId],
        });
    });

    // Return the canonical event payload shape expected by calendar pages/cards.
    return {
        id: String(eventDoc?._id || ""),
        createdById,
        eventType: eventDoc?.eventType || "Social",
        title: eventDoc?.title || "",
        description: eventDoc?.description || "",
        genres: Array.isArray(eventDoc?.genres) ? eventDoc.genres : [],
        musicFormat: normalizedMusicFormat,
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
        resellers,
        attendeesCount: allAttendees.length,
        isGoing: normalizedCurrentUserId ? allAttendees.some((attendee) => attendee.userId === normalizedCurrentUserId) : false,
        canEdit: String(currentUserId || "") === createdById,
        createdAt: eventDoc?.createdAt,
        updatedAt: eventDoc?.updatedAt,
        editedAt: eventDoc?.editedAt || null,
    };
};
