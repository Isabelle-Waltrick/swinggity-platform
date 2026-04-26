/**
 * Calendar event response service.
 *
 * This module builds reusable viewer/context maps once and applies them during
 * event serialization so all calendar endpoints return a consistent payload shape.
 */

import { Profile } from "../models/profile.model.js";
import { isAdminRole } from "../utils/rolePermissions.js";
import { asTrimmedString, getIdSet } from "../validators/calendar.utils.js";
import { toClientEvent } from "../serializers/calendar.serializer.js";
import {
    getOrganisationSummaryMapByIds,
    getProfileAvatarMapByUserIds,
    getProfileDisplayNameMapByUserIds,
    getProfileJamCircleSetMapByUserIds,
} from "./calendar.lookup.service.js";

// Normalizes single event or event array input into a clean list for downstream helpers.
const asEventList = (events) => (Array.isArray(events) ? events.filter(Boolean) : [events].filter(Boolean));

// Collects all user ids referenced by event creators and attendees.
const collectProfileUserIdsFromEvents = (events) => {
    const ids = asEventList(events).flatMap((event) => [
        String(event?.createdBy?._id || event?.createdBy || ""),
        ...(Array.isArray(event?.attendees)
            ? event.attendees.map((attendee) => String(attendee?.user?._id || attendee?.user || ""))
            : []),
    ]);

    return [...new Set(ids.filter(Boolean))];
};

// Collects organisation ids referenced by co-host contacts and organisation publishers.
const collectOrganisationIdsFromEvents = (events) => {
    const ids = asEventList(events).flatMap((event) => {
        const coHostOrganisationIds = Array.isArray(event?.coHostContacts)
            ? event.coHostContacts
                .filter((contact) => asTrimmedString(contact?.entityType) === "organisation")
                .map((contact) => String(contact?.organisationId || ""))
            : [];
        const publisherOrganisationId = asTrimmedString(event?.publisherType) === "organisation"
            ? String(event?.publisherOrganisationId || "")
            : "";

        return publisherOrganisationId
            ? [...coHostOrganisationIds, publisherOrganisationId]
            : coHostOrganisationIds;
    });

    return [...new Set(ids.filter(Boolean))];
};

/**
 * buildEventClientContext:
 * Prepares lookup/context maps used by serializers to produce viewer-aware event payloads.
 */
export const buildEventClientContext = async ({ events, viewerUser }) => {
    // Derive all ids up front so each map query runs once per response batch.
    const eventList = asEventList(events);
    const profileUserIds = collectProfileUserIdsFromEvents(eventList);
    const organisationIds = collectOrganisationIdsFromEvents(eventList);

    // Run independent lookup queries in parallel to reduce response time.
    const [viewerProfile, organizerAvatarMap, displayNameMap, attendeeCircleSetMap, organisationSummaryMap] = await Promise.all([
        // We need the viewer's profile to get their circle memberships for attendee list flags.
        Profile.findOne({ user: viewerUser._id }).select("jamCircleMembers").lean(),
        // Avatar map is used for both event creator and attendees to render profile images in the client.
        getProfileAvatarMapByUserIds(profileUserIds),
        // Display name map is used to resolve both creator and attendee names in the client.
        getProfileDisplayNameMapByUserIds(profileUserIds),
        // Attendee circle set map is used to determine which attendees are in the same circles as the viewer for UI badges.
        getProfileJamCircleSetMapByUserIds(profileUserIds),
        // Organisation summary map is used to resolve publisher/host organisation names and avatars in the client.
        getOrganisationSummaryMapByIds(organisationIds),
    ]);

    // Return one context object that can be reused across all serialized events.
    return {
        organizerAvatarMap,
        displayNameMap,
        attendeeCircleSetMap,
        organisationSummaryMap,
        viewerCircleSet: getIdSet(viewerProfile?.jamCircleMembers),
        canViewAllAttendees: isAdminRole(viewerUser.role),
    };
};

/**
 * serializeEventWithContext:
 * Serializes one event using prebuilt context maps to avoid repeated lookup work.
 */
export const serializeEventWithContext = ({ event, viewerUserId, context }) => {
    // Resolve creator id across both populated and unpopulated createdBy shapes.
    const createdById = String(event?.createdBy?._id || event?.createdBy || "");
    return toClientEvent(event, viewerUserId, {
        // Provide organizer AVATAR fallback so event cards can always render an image slot.
        organizerAvatarUrl: context.organizerAvatarMap[createdById] || "",
        // Provide ORGANISER DISPLAY NAME resolved from the shared display-name lookup map.
        organizerDisplayName: context.displayNameMap[createdById] || "",
        // Reuse one ATTENDEE DISPLAY NAME map for all attendee name lookups in the serializer.
        attendeeDisplayNameMap: context.displayNameMap,
        // Attach ATTENDEE CIRCLE SET memberships so the client can compute circle badges/visibility.
        attendeeCircleSetMap: context.attendeeCircleSetMap,
        // Resolve CO-HOST ORGANISATION MAP metadata (name/avatar) from preloaded organisation summaries.
        coHostOrganisationMap: context.organisationSummaryMap,
        // Resolve PUBLISHER ORGANISATION MAP metadata from the same preloaded organisation summaries.
        publisherOrganisationMap: context.organisationSummaryMap,
        // Pass VIEWER CIRCLE SET memberships so attendee relationship checks stay viewer-aware.
        viewerCircleSet: context.viewerCircleSet,
        // Carry CAN VIEW ALL ATTENDEES flag that controls whether all attendees are fully visible.
        canViewAllAttendees: context.canViewAllAttendees,
    });
};
