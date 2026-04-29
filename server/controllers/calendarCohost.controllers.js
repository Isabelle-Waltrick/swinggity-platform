// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Co-host Controllers Guide
 * These handlers manage invitation fetch/respond flows for event co-hosting.
 * They map request/response responsibilities while delegating core workflow logic.
 */

import crypto from "crypto";
import mongoose from "mongoose";
import { Profile } from "../models/profile.model.js";
import { asTrimmedString } from "../validators/calendar.utils.js";
import {
    appendCoHostResponseNotification,
    applyAcceptedCoHostToEvent,
} from "../services/calendar.cohost.service.js";
import { findUserOrReject } from "./calendar.controllerShared.js";

export const getPendingCoHostInvitations = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const profile = await Profile.findOne({ user: user._id }).lean();
        if (!profile) {
            return res.status(200).json({ success: true, invitations: [] });
        }

        const pendingInvitations = (Array.isArray(profile.pendingCoHostInvitations) ? profile.pendingCoHostInvitations : [])
            .filter((invite) => {
                const expiresAt = invite?.expiresAt ? new Date(invite.expiresAt).getTime() : 0;
                return expiresAt > Date.now();
            })
            .map((invite) => {
                const contactType = asTrimmedString(invite?.contactType) === "organisation" ? "organisation" : "member";
                const contactDisplayName = asTrimmedString(invite?.contactDisplayName) || "this contact";

                return {
                    tokenHash: asTrimmedString(invite?.tokenHash),
                    eventId: String(invite?.eventId || ""),
                    eventTitle: asTrimmedString(invite?.eventTitle) || "Untitled event",
                    invitedBy: String(invite?.invitedBy || ""),
                    inviterName: asTrimmedString(invite?.invitedByName) || "A Swinggity member",
                    inviterAvatarUrl: asTrimmedString(invite?.invitedByAvatarUrl),
                    invitedAt: invite?.invitedAt || new Date(),
                    expiresAt: invite?.expiresAt || new Date(),
                    notificationType: "cohost",
                    inviteText: contactType === "organisation"
                        ? `invited ${contactDisplayName} to co-host an event`
                        : "invited you to co-host an event",
                };
            });

        return res.status(200).json({
            success: true,
            invitations: pendingInvitations,
        });
    } catch (error) {
        console.log("Error in getPendingCoHostInvitations", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getPendingCoHostStatusNotifications = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const profile = await Profile.findOne({ user: user._id }).lean();
        if (!profile) {
            return res.status(200).json({ success: true, notifications: [] });
        }

        const notifications = (Array.isArray(profile.coHostInvitationResponses) ? profile.coHostInvitationResponses : [])
            .map((item) => {
                const response = asTrimmedString(item?.response) === "accept" ? "accept" : "deny";
                const eventTitle = asTrimmedString(item?.eventTitle) || "your event";
                return {
                    notificationId: String(item?._id || ""),
                    inviterName: asTrimmedString(item?.inviteeName) || "A Swinggity member",
                    inviterAvatarUrl: asTrimmedString(item?.inviteeAvatarUrl),
                    eventId: String(item?.eventId || ""),
                    eventTitle,
                    response,
                    invitedAt: item?.respondedAt || new Date(),
                    notificationType: "cohost-status",
                    inviteText: response === "accept"
                        ? `accepted your co-host request for ${eventTitle}`
                        : `denied your co-host request for ${eventTitle}`,
                };
            })
            .sort((left, right) => new Date(right?.invitedAt || 0).getTime() - new Date(left?.invitedAt || 0).getTime());

        return res.status(200).json({
            success: true,
            notifications,
        });
    } catch (error) {
        console.log("Error in getPendingCoHostStatusNotifications", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const dismissCoHostStatusNotification = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const notificationId = asTrimmedString(req.body?.notificationId);
        if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
            return res.status(400).json({ success: false, message: "Invalid notification id" });
        }

        const profile = await Profile.findOne({ user: user._id });
        if (!profile) {
            return res.status(404).json({ success: false, message: "Profile not found" });
        }

        const currentItems = Array.isArray(profile.coHostInvitationResponses)
            ? profile.coHostInvitationResponses
            : [];
        profile.coHostInvitationResponses = currentItems.filter(
            (item) => String(item?._id || "") !== notificationId
        );
        await profile.save();

        return res.status(200).json({ success: true, message: "Notification dismissed" });
    } catch (error) {
        console.log("Error in dismissCoHostStatusNotification", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const respondToCoHostInvitationInApp = async (req, res) => {
    try {
        const userId = String(req.userId || "");
        const { tokenHash, action } = req.body;

        if (!asTrimmedString(tokenHash)) {
            return res.status(400).json({ success: false, message: "Invalid invitation token" });
        }

        if (action !== "accept" && action !== "deny") {
            return res.status(400).json({ success: false, message: "Invalid action" });
        }

        const profile = await Profile.findOne({ user: userId });
        if (!profile) {
            return res.status(404).json({ success: false, message: "Profile not found" });
        }

        const pendingInvites = Array.isArray(profile.pendingCoHostInvitations)
            ? profile.pendingCoHostInvitations
            : [];
        const invitation = pendingInvites.find((item) => asTrimmedString(item?.tokenHash) === asTrimmedString(tokenHash));

        if (!invitation) {
            return res.status(404).json({ success: false, message: "Invitation not found" });
        }

        if (!invitation.expiresAt || new Date(invitation.expiresAt).getTime() < Date.now()) {
            profile.pendingCoHostInvitations = pendingInvites.filter((item) => asTrimmedString(item?.tokenHash) !== asTrimmedString(tokenHash));
            await profile.save();
            return res.status(410).json({ success: false, message: "This invitation has expired" });
        }

        profile.pendingCoHostInvitations = pendingInvites.filter((item) => asTrimmedString(item?.tokenHash) !== asTrimmedString(tokenHash));

        if (action === "accept") {
            await applyAcceptedCoHostToEvent(profile, invitation);
        }

        await profile.save();
        await appendCoHostResponseNotification({ invitation, inviteeProfile: profile, action });

        return res.status(200).json({
            success: true,
            message: action === "accept" ? "Co-host request accepted" : "Co-host request denied",
        });
    } catch (error) {
        console.log("Error in respondToCoHostInvitationInApp", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const respondToCoHostInvitation = async (req, res) => {
    try {
        const { token, action } = req.query;

        if (!token || typeof token !== "string") {
            return res.status(400).send("Invalid invitation token.");
        }

        if (action !== "accept" && action !== "deny") {
            return res.status(400).send("Invalid invitation action.");
        }

        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const profile = await Profile.findOne({ "pendingCoHostInvitations.tokenHash": tokenHash });
        if (!profile) {
            return res.status(404).send("This invitation was not found or has already been used.");
        }

        const pendingInvites = Array.isArray(profile.pendingCoHostInvitations)
            ? profile.pendingCoHostInvitations
            : [];
        const invitation = pendingInvites.find((item) => asTrimmedString(item?.tokenHash) === tokenHash);
        if (!invitation) {
            return res.status(404).send("This invitation was not found or has already been used.");
        }

        if (!invitation.expiresAt || new Date(invitation.expiresAt).getTime() < Date.now()) {
            profile.pendingCoHostInvitations = pendingInvites.filter((item) => asTrimmedString(item?.tokenHash) !== tokenHash);
            await profile.save();
            return res.status(410).send("This invitation has expired.");
        }

        profile.pendingCoHostInvitations = pendingInvites.filter((item) => asTrimmedString(item?.tokenHash) !== tokenHash);

        if (action === "accept") {
            await applyAcceptedCoHostToEvent(profile, invitation);
        }

        await profile.save();
        await appendCoHostResponseNotification({ invitation, inviteeProfile: profile, action });

        const statusText = action === "accept" ? "accepted" : "denied";
        const actionMessage = action === "accept"
            ? "Co-host request accepted. Your contact will now be shown on the event overview."
            : "Co-host request denied. Your contact will not be shown on the event.";

        return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Co-host invitation ${statusText}</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; color: #333; max-width: 620px; margin: 40px auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; text-transform: capitalize;">Co-host request ${statusText}</h1>
  </div>
  <div style="background: #fff; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p style="margin: 0;">${actionMessage}</p>
  </div>
</body>
</html>
`);
    } catch (error) {
        console.log("Error in respondToCoHostInvitation", error);
        return res.status(500).send("Something went wrong while processing this invitation.");
    }
};
