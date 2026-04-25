/**
 * Calendar Event Response Service Guide
 * This service builds shared context used to serialize event responses consistently.
 * It gathers lookup maps once (avatars, display names, circles, organisations)
 * so handlers can return the same shape without repetitive code blocks.
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

const asEventList = (events) => (Array.isArray(events) ? events.filter(Boolean) : [events].filter(Boolean));

const collectProfileUserIdsFromEvents = (events) => {
    const ids = asEventList(events).flatMap((event) => [
        String(event?.createdBy?._id || event?.createdBy || ""),
        ...(Array.isArray(event?.attendees)
            ? event.attendees.map((attendee) => String(attendee?.user?._id || attendee?.user || ""))
            : []),
    ]);

    return [...new Set(ids.filter(Boolean))];
};

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

export const buildEventClientContext = async ({ events, viewerUser }) => {
    const eventList = asEventList(events);
    const profileUserIds = collectProfileUserIdsFromEvents(eventList);
    const organisationIds = collectOrganisationIdsFromEvents(eventList);

    const [viewerProfile, organizerAvatarMap, displayNameMap, attendeeCircleSetMap, organisationSummaryMap] = await Promise.all([
        Profile.findOne({ user: viewerUser._id }).select("jamCircleMembers").lean(),
        getProfileAvatarMapByUserIds(profileUserIds),
        getProfileDisplayNameMapByUserIds(profileUserIds),
        getProfileJamCircleSetMapByUserIds(profileUserIds),
        getOrganisationSummaryMapByIds(organisationIds),
    ]);

    return {
        organizerAvatarMap,
        displayNameMap,
        attendeeCircleSetMap,
        organisationSummaryMap,
        viewerCircleSet: getIdSet(viewerProfile?.jamCircleMembers),
        canViewAllAttendees: isAdminRole(viewerUser.role),
    };
};

export const serializeEventWithContext = ({ event, viewerUserId, context }) => {
    const createdById = String(event?.createdBy?._id || event?.createdBy || "");
    return toClientEvent(event, viewerUserId, {
        organizerAvatarUrl: context.organizerAvatarMap[createdById] || "",
        organizerDisplayName: context.displayNameMap[createdById] || "",
        attendeeDisplayNameMap: context.displayNameMap,
        attendeeCircleSetMap: context.attendeeCircleSetMap,
        coHostOrganisationMap: context.organisationSummaryMap,
        publisherOrganisationMap: context.organisationSummaryMap,
        viewerCircleSet: context.viewerCircleSet,
        canViewAllAttendees: context.canViewAllAttendees,
    });
};
