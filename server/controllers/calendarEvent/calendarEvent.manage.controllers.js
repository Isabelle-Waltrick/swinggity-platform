// The code in this file were created with help of AI (Copilot)

/**
 * Calendar manage controllers.
 *
 * These handlers own update/delete event flows, including authorization,
 * payload normalization, media lifecycle cleanup, and activity sync.
 */

import { CalendarEvent } from "../../models/calendarEvent.model.js";
import mongoose from "mongoose";
import {
    asTrimmedString,
    buildCoHostContactKey,
    buildCoHostsTextFromContacts,
    parseCoHostSelection,
    parseRemovedCoHostKeys,
} from "../../validators/calendar.utils.js";
import { appendCoHostInvitation } from "../../services/calendar.cohost.service.js";
import { deleteEventImageAsset, storeEventImageAsset } from "../../services/calendar.media.service.js";
import { buildEventClientContext, serializeEventWithContext } from "../../services/calendar.eventResponse.service.js";
import {
    buildMergedEventUpdateBody,
    normalizeAndValidateEventInput,
    pickProvidedEventUpdates,
    resolvePublisherSelection,
} from "../../services/calendar.eventPayload.service.js";
import { removeEventActivityFromProfile, upsertProfileActivity } from "../../services/calendar.activity.service.js";
import { findUserOrReject, canManageEvent } from "../calendar.controllerShared.js";
import { canDeleteCalendarEvent, isAdminRole } from "../../utils/rolePermissions.js";

/**
 * updateCalendarEvent:
 * Applies validated event updates, handles optional media replacement, and
 * returns the refreshed serialized event.
 */
export const updateCalendarEvent = async (req, res) => {
    let uploadedImageAsset = null;
    let eventUpdated = false;
    try {
        const { eventId } = req.params;
        // Reuse middleware-loaded user when present to avoid duplicate DB reads.
        const user = req.authUser || await findUserOrReject(req.userId, res);
        if (!user) return;

        // Load target event and enforce owner-level manage permissions.
        const event = await CalendarEvent.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }
        if (!canManageEvent(user, event)) {
            return res.status(403).json({ success: false, message: "Only event owners can update events" });
        }
        // Accept only whitelisted update fields; reject empty patch requests.
        const updates = pickProvidedEventUpdates(req.body);
        if (Object.keys(updates).length === 0 && !req.file) {
            return res.status(400).json({ success: false, message: "No event fields provided to update" });
        }
        // Merge existing+incoming state, then validate as a full event payload.
        const mergedBody = buildMergedEventUpdateBody({ event, updates });
        const normalized = normalizeAndValidateEventInput({ body: mergedBody, mode: "update" });
        if (!normalized.success) {
            return res.status(normalized.status).json({ success: false, message: normalized.message });
        }
        // Resolve publishing identity (member vs organisation) under current role rules.
        const isAdminUser = isAdminRole(user.role);
        const publisher = await resolvePublisherSelection({
            user,
            isAdminUser,
            publisherTypeInput: mergedBody.publisherType,
            publisherOrganisationIdInput: mergedBody.publisherOrganisationId,
            defaultPublisherType: event.publisherType || "member",
            defaultPublisherOrganisationId: event.publisherOrganisationId || null,
        });
        if (!publisher.success) {
            return res.status(publisher.status).json({ success: false, message: publisher.message });
        }

        // Apply normalized values back onto the live event document.
        const data = normalized.data;
        event.eventType = data.eventType;
        event.title = data.title;
        event.description = data.description;
        event.genres = data.genres;
        event.musicFormat = data.musicFormat;
        event.startDate = data.startDate;
        event.startTime = data.startTime;
        event.endDate = data.endDate;
        event.endTime = data.endTime;
        event.venue = data.venue;
        event.address = data.address;
        event.city = data.city;
        event.onlineEvent = data.onlineEvent;
        event.ticketType = data.ticketType;
        event.freeEvent = data.freeEvent;
        event.minPrice = data.minPrice;
        event.maxPrice = data.maxPrice;
        event.fixedPrice = data.fixedPrice;
        event.currency = data.currency;
        event.ticketLink = data.ticketLink;
        event.allowResell = data.allowResell;
        event.resellCondition = data.allowResell === "no" ? "When tickets are sold-out" : data.resellCondition;
        event.resellActivated = data.allowResell === "yes" && data.resellCondition === "Always"
            ? true
            : (data.allowResell === "yes" ? Boolean(event.resellActivated) : false);
        event.onlineLinks = data.onlineLinks;

        event.publisherType = publisher.publisherType;
        event.publisherOrganisationId = publisher.publisherOrganisationId;

        // Remove co-host contacts only for explicitly requested keys.
        const removedCoHostKeys = isAdminUser ? [] : parseRemovedCoHostKeys(mergedBody.removedCoHostKeys);
        if (removedCoHostKeys.length > 0) {
            const removalSet = new Set(removedCoHostKeys);
            event.coHostContacts = (Array.isArray(event.coHostContacts) ? event.coHostContacts : [])
                .filter((contact) => !removalSet.has(buildCoHostContactKey(contact)));
        }
        event.coHosts = buildCoHostsTextFromContacts(event.coHostContacts);

        // When replacing the image, defer deleting old media until save succeeds.
        const previousImageUrl = event.imageUrl;
        const previousImageStorageId = event.imageStorageId;
        if (req.file && !isAdminUser) {
            uploadedImageAsset = await storeEventImageAsset({ file: req.file, userId: user._id });
            event.imageUrl = uploadedImageAsset.imageUrl;
            event.imageStorageId = uploadedImageAsset.imageStorageId;
        }
        // Update the editedAt timestamp to reflect this manual update action.
        event.editedAt = new Date();
        await event.save();
        eventUpdated = true;

        // Treat co-host invitation errors as non-fatal update warnings.
        const selectedCoHost = isAdminUser ? null : parseCoHostSelection(mergedBody);
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

        // New image is now live, so old image can be safely cleaned up.
        if (uploadedImageAsset) {
            await deleteEventImageAsset({ imageUrl: previousImageUrl, imageStorageId: previousImageStorageId });
        }

        // Record an update activity line for profile feeds.
        await upsertProfileActivity(user, {
            type: "event.updated",
            entityType: "event",
            entityId: event._id,
            message: `Updated event: ${event.title}`,
            createdAt: new Date(),
        });

        // Return freshly populated+serialized event to keep client state in sync.
        const populated = await CalendarEvent.findById(event._id)
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email")
            .lean();
        const context = await buildEventClientContext({ events: [populated], viewerUser: user });

        return res.status(200).json({
            success: true,
            message: "Event updated successfully",
            event: serializeEventWithContext({
                event: populated,
                viewerUserId: user._id,
                context,
            }),
            coHostInviteWarning,
        });
    } catch (error) {
        // If update fails after new upload, clean up the orphaned uploaded asset.
        if (!eventUpdated && uploadedImageAsset) {
            await deleteEventImageAsset(uploadedImageAsset);
        }
        console.log("Error in updateCalendarEvent", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * deleteCalendarEvent:
 * Deletes an event, cleans up related image assets, and removes stale activity records.
 */
export const deleteCalendarEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        // Reuse middleware-loaded user when available.
        const user = req.authUser || await findUserOrReject(req.userId, res);
        if (!user) return;

        // Resolve the target event before authorization and cleanup actions.
        const event = await CalendarEvent.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        // Allow delete only for authorized owners/admins under role permission rules.
        if (!canDeleteCalendarEvent({ role: user.role, isEventOwner: canManageEvent(user, event) })) {
            return res.status(403).json({ success: false, message: "Only event owners can delete events" });
        }
        // Capture owner ID for post-deletion cleanup, accounting for potential nulls.
        const eventOwnerId = String(event?.createdBy?._id || event?.createdBy || "");
        // Remove event record first, then clean up media and activity artifacts.
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
