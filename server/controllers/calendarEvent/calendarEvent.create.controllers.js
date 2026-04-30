// The code in this file were created with help of AI (Copilot)

/**
 * Calendar create controller.
 *
 * This handler owns the create-event flow from request validation through
 * persistence, activity logging, and final response serialization.
 */

import { CalendarEvent } from "../../models/calendarEvent.model.js";
import { parseCoHostSelection } from "../../validators/calendar.utils.js";
import { buildActivityLine, upsertProfileActivity } from "../../services/calendar.activity.service.js";
import { appendCoHostInvitation } from "../../services/calendar.cohost.service.js";
import { deleteEventImageAsset, storeEventImageAsset } from "../../services/calendar.media.service.js";
import { buildEventClientContext, serializeEventWithContext } from "../../services/calendar.eventResponse.service.js";
import { normalizeAndValidateEventInput, resolvePublisherSelection } from "../../services/calendar.eventPayload.service.js";
import { findUserOrReject } from "../calendar.controllerShared.js";
import { isAdminRole } from "../../utils/rolePermissions.js";

/**
 * createCalendarEvent:
 * Creates a new event, optionally stores media, appends activity, and returns
 * a fully serialized event payload for immediate client rendering.
 */
// FR31-FR40: Backend handler for event creation; validates and persists all fields submitted by Organiser/Admin.
// FR31: eventType validated from allowed enum values in normalizeAndValidateEventInput.
// FR32: title validated (non-empty string) in normalizeAndValidateEventInput.
// FR33: description validated and stored.
// FR34: image stored via storeEventImageAsset when file is present.
// FR35: startDate, startTime, endDate, endTime stored.
// FR36: venue, address, city stored.
// FR37: ticketType, freeEvent, minPrice, maxPrice, currency, ticketLink stored.
// FR38: onlineLinks (instagram, facebook, youtube, linkedin, website) stored.
// FR39: co-host invite appended via appendCoHostInvitation when selectedCoHost present.
// FR40: event is persisted to DB only after all required-field validation passes.
export const createCalendarEvent = async (req, res) => {
    let uploadedImageAsset = null;
    let eventCreated = false;
    try {
        // Resolve the authenticated user once and reuse it throughout the flow.
        const user = req.authUser || await findUserOrReject(req.userId, res);
        if (!user) return;

        // Normalize and validate request fields before any writes occur.
        const normalized = normalizeAndValidateEventInput({ body: req.body, mode: "create" });
        if (!normalized.success) {
            return res.status(normalized.status).json({ success: false, message: normalized.message });
        }

        // Admins skip co-host logic and image uploads by design.
        const isAdminUser = isAdminRole(user.role);
        const selectedCoHost = isAdminUser ? null : parseCoHostSelection(req.body);

        // Resolve whether this event is published as member or organisation.
        const publisher = await resolvePublisherSelection({
            user,
            isAdminUser,
            publisherTypeInput: req.body.publisherType,
            publisherOrganisationIdInput: req.body.publisherOrganisationId,
            defaultPublisherType: "member",
            defaultPublisherOrganisationId: null,
        });
        if (!publisher.success) {
            return res.status(publisher.status).json({ success: false, message: publisher.message });
        }
        // Save image only when a non-admin attached one; otherwise keep image fields empty.
        uploadedImageAsset = isAdminUser
            ? { imageUrl: "", imageStorageId: "" }
            : req.file
                ? await storeEventImageAsset({ file: req.file, userId: user._id })
                : { imageUrl: "", imageStorageId: "" };

        // Persist the new event with normalized data and derived resale defaults.
        const data = normalized.data;
        const event = await CalendarEvent.create({
            createdBy: user._id,
            eventType: data.eventType,
            title: data.title,
            description: data.description,
            genres: data.genres,
            musicFormat: data.musicFormat,
            startDate: data.startDate,
            startTime: data.startTime,
            endDate: data.endDate,
            endTime: data.endTime,
            venue: data.venue,
            address: data.address,
            city: data.city,
            onlineEvent: data.onlineEvent,
            ticketType: data.ticketType,
            freeEvent: data.freeEvent,
            minPrice: data.minPrice,
            maxPrice: data.maxPrice,
            fixedPrice: data.fixedPrice,
            currency: data.currency,
            ticketLink: data.ticketLink,
            allowResell: data.allowResell,
            resellCondition: data.allowResell === "no" ? "When tickets are sold-out" : data.resellCondition,
            resellActivated: data.allowResell === "yes" && data.resellCondition === "Always",
            onlineLinks: data.onlineLinks,
            coHosts: "",
            coHostContacts: [],
            imageUrl: uploadedImageAsset.imageUrl,
            imageStorageId: uploadedImageAsset.imageStorageId,
            publisherType: publisher.publisherType,
            publisherOrganisationId: publisher.publisherOrganisationId,
            editedAt: null,
        });
        eventCreated = true;

        // Co-host invite failures should not fail event creation; surface as warning instead.
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

        // Add a profile activity entry so member feeds reflect the newly created event.
        const activityLine = buildActivityLine(data.title, data.startDate, data.startTime);
        const activityItem = {
            type: "event.created",
            entityType: "event",
            entityId: event._id,
            message: activityLine,
            createdAt: new Date(),
        };
        await upsertProfileActivity(user, activityItem);

        // Serialize with full context so cards and detail views share identical response shape.
        const eventWithUserCreator = { ...event.toObject(), createdBy: user };
        const context = await buildEventClientContext({ events: [eventWithUserCreator], viewerUser: user });

        return res.status(201).json({
            success: true,
            message: "Event created successfully",
            event: serializeEventWithContext({
                event: eventWithUserCreator,
                viewerUserId: user._id,
                context,
            }),
            activityLine,
            activityItem,
            coHostInviteWarning,
        });
    } catch (error) {
        // Roll back uploaded media when event creation fails before persistence completes.
        if (!eventCreated && uploadedImageAsset) {
            await deleteEventImageAsset(uploadedImageAsset);
        }
        console.log("Error in createCalendarEvent", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
