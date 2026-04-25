/**
 * Calendar Create Controller Guide
 * This file handles event creation from request to final response.
 * Typical flow: auth context -> payload validation -> publisher resolution ->
 * optional media storage -> event create -> activity update -> serialize response.
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

export const createCalendarEvent = async (req, res) => {
    let uploadedImageAsset = null;
    let eventCreated = false;
    try {
        const user = req.authUser || await findUserOrReject(req.userId, res);
        if (!user) return;

        const normalized = normalizeAndValidateEventInput({ body: req.body, mode: "create" });
        if (!normalized.success) {
            return res.status(normalized.status).json({ success: false, message: normalized.message });
        }

        const isAdminUser = isAdminRole(user.role);
        const selectedCoHost = isAdminUser ? null : parseCoHostSelection(req.body);

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

        uploadedImageAsset = isAdminUser
            ? { imageUrl: "", imageStorageId: "" }
            : req.file
                ? await storeEventImageAsset({ file: req.file, userId: user._id })
                : { imageUrl: "", imageStorageId: "" };

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

        const activityLine = buildActivityLine(data.title, data.startDate, data.startTime);
        const activityItem = {
            type: "event.created",
            entityType: "event",
            entityId: event._id,
            message: activityLine,
            createdAt: new Date(),
        };
        await upsertProfileActivity(user, activityItem);

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
        if (!eventCreated && uploadedImageAsset) {
            await deleteEventImageAsset(uploadedImageAsset);
        }
        console.log("Error in createCalendarEvent", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
