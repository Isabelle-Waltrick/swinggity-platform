import crypto from "crypto";
import { sendCoHostInviteEmail } from "../mailtrap/emails.js";
import { COHOST_INVITATION_EXPIRY_MS } from "../constants/calendar.constants.js";
import { CalendarEvent } from "../models/calendarEvent.model.js";
import { Organisation } from "../models/organisation.model.js";
import { Profile } from "../models/profile.model.js";
import { User } from "../models/user.model.js";
import {
    asTrimmedString,
    buildCoHostsTextFromContacts,
    buildUserDisplayName,
    isValidObjectIdString,
    resolveAbsoluteAssetUrl,
} from "../validators/calendar.validators.js";

export const appendCoHostInvitation = async ({ req, event, requesterUser, selectedCoHost }) => {
    if (!selectedCoHost) return;

    const requesterUserId = String(requesterUser?._id || "");
    const requesterProfile = await Profile.findOne({ user: requesterUserId }).lean();
    const requesterName = buildUserDisplayName(
        requesterProfile?.displayFirstName || requesterUser?.firstName,
        requesterProfile?.displayLastName || requesterUser?.lastName,
        requesterUser?.email
    );
    const requesterAvatarRelative = asTrimmedString(requesterProfile?.avatarUrl);
    const requesterAvatarAbsolute = resolveAbsoluteAssetUrl(req, requesterAvatarRelative);
    const fallbackAvatar = "https://ui-avatars.com/api/?name=Swinggity+Member&background=FF6699&color=ffffff&size=256";

    let inviteeUserId = selectedCoHost.coHostUserId;
    let organisationId = null;
    let contactDisplayName = selectedCoHost.coHostDisplayName || "";

    if (!isValidObjectIdString(inviteeUserId)) {
        throw new Error("Selected co-host is invalid");
    }

    if (selectedCoHost.coHostType === "organisation") {
        const organisationIdCandidate = selectedCoHost.coHostOrganisationId || selectedCoHost.coHostUserId;
        if (!isValidObjectIdString(organisationIdCandidate)) {
            throw new Error("Selected organisation is invalid");
        }

        const organisation = await Organisation.findById(organisationIdCandidate).lean();
        if (!organisation || !isValidObjectIdString(organisation.user)) {
            throw new Error("Organisation owner was not found");
        }

        inviteeUserId = String(organisation.user);
        organisationId = organisation._id;
        if (!contactDisplayName) {
            contactDisplayName = asTrimmedString(organisation.organisationName) || "Swinggity Organisation";
        }
    }

    if (String(inviteeUserId) === requesterUserId) {
        throw new Error("You cannot add yourself as a co-host");
    }

    const [inviteeUser, inviteeProfileRaw] = await Promise.all([
        User.findById(inviteeUserId),
        Profile.findOne({ user: inviteeUserId }),
    ]);

    if (!inviteeUser) {
        throw new Error("Selected co-host is no longer available");
    }

    const inviteeProfile = inviteeProfileRaw || await Profile.create({
        user: inviteeUserId,
        displayFirstName: inviteeUser.firstName,
        displayLastName: inviteeUser.lastName,
    });

    if (!contactDisplayName) {
        contactDisplayName = buildUserDisplayName(
            inviteeProfile?.displayFirstName || inviteeUser.firstName,
            inviteeProfile?.displayLastName || inviteeUser.lastName,
            inviteeUser.email
        );
    }

    const pendingInvites = Array.isArray(inviteeProfile.pendingCoHostInvitations)
        ? inviteeProfile.pendingCoHostInvitations
        : [];
    const hasActiveInvite = pendingInvites.some((invite) => {
        if (String(invite?.eventId || "") !== String(event._id || "")) return false;
        if (String(invite?.invitedBy || "") !== requesterUserId) return false;
        const expiresAt = invite?.expiresAt ? new Date(invite.expiresAt).getTime() : 0;
        return expiresAt > Date.now();
    });

    if (hasActiveInvite) {
        return;
    }

    const invitationToken = crypto.randomBytes(32).toString("hex");
    const invitationTokenHash = crypto.createHash("sha256").update(invitationToken).digest("hex");
    const expiresAt = new Date(Date.now() + COHOST_INVITATION_EXPIRY_MS);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const encodedToken = encodeURIComponent(invitationToken);
    const acceptUrl = `${baseUrl}/api/calendar/cohost-invitations/respond?token=${encodedToken}&action=accept`;
    const denyUrl = `${baseUrl}/api/calendar/cohost-invitations/respond?token=${encodedToken}&action=deny`;

    inviteeProfile.pendingCoHostInvitations = [
        ...pendingInvites,
        {
            tokenHash: invitationTokenHash,
            eventId: event._id,
            eventTitle: asTrimmedString(event.title).slice(0, 120),
            invitedBy: requesterUser._id,
            invitedByName: requesterName,
            invitedByAvatarUrl: requesterAvatarRelative,
            contactType: selectedCoHost.coHostType,
            contactDisplayName,
            organisationId,
            invitedAt: new Date(),
            expiresAt,
        },
    ];
    await inviteeProfile.save();

    await sendCoHostInviteEmail({
        recipientEmail: inviteeUser.email,
        inviterName: requesterName,
        inviterAvatarUrl: requesterAvatarAbsolute || fallbackAvatar,
        eventTitle: asTrimmedString(event.title).slice(0, 120) || "your event",
        coHostDisplayName: selectedCoHost.coHostType === "organisation" ? contactDisplayName : "you",
        acceptUrl,
        denyUrl,
    });
};

export const applyAcceptedCoHostToEvent = async (inviteeProfile, invitation) => {
    const event = await CalendarEvent.findById(invitation.eventId);
    if (!event) return;

    const isOrganisationContact = invitation.contactType === "organisation";
    let contactDisplayName = asTrimmedString(invitation.contactDisplayName);
    let contactAvatarUrl = asTrimmedString(inviteeProfile.avatarUrl);
    let organisationId = null;

    if (isOrganisationContact && isValidObjectIdString(invitation.organisationId)) {
        const organisation = await Organisation.findById(invitation.organisationId).lean();
        if (organisation) {
            organisationId = organisation._id;
            contactDisplayName = contactDisplayName
                || asTrimmedString(organisation.organisationName)
                || "Swinggity Organisation";
            contactAvatarUrl = asTrimmedString(organisation.imageUrl);
        }
    }

    const contactEntry = {
        user: inviteeProfile.user,
        entityType: isOrganisationContact ? "organisation" : "member",
        organisationId: isOrganisationContact ? organisationId : null,
        displayName: contactDisplayName,
        avatarUrl: contactAvatarUrl,
    };

    const existingContacts = Array.isArray(event.coHostContacts) ? event.coHostContacts : [];
    const filteredContacts = existingContacts.filter((contact) => {
        const sameUser = String(contact?.user || "") === String(contactEntry.user || "");
        const sameOrg = String(contact?.organisationId || "") === String(contactEntry.organisationId || "");
        const sameType = asTrimmedString(contact?.entityType) === asTrimmedString(contactEntry.entityType);
        return !(sameUser && sameOrg && sameType);
    });

    event.coHostContacts = [...filteredContacts, contactEntry].slice(0, 10);
    event.coHosts = buildCoHostsTextFromContacts(event.coHostContacts);
    await event.save();
};

export const appendCoHostResponseNotification = async ({ invitation, inviteeProfile, action }) => {
    if (!invitation || (action !== "accept" && action !== "deny")) return;

    const inviterUserId = String(invitation?.invitedBy || "").trim();
    if (!isValidObjectIdString(inviterUserId)) return;

    const inviteeUserId = String(inviteeProfile?.user || "").trim();
    if (!isValidObjectIdString(inviteeUserId)) return;

    const inviteeName = asTrimmedString(invitation?.contactDisplayName)
        || buildUserDisplayName(inviteeProfile?.displayFirstName, inviteeProfile?.displayLastName, "")
        || "Swinggity Member";

    const isOrganisationContact = asTrimmedString(invitation?.contactType) === "organisation";
    let inviteeAvatarUrl = asTrimmedString(inviteeProfile?.avatarUrl);

    if (isOrganisationContact && isValidObjectIdString(invitation?.organisationId)) {
        const organisation = await Organisation.findById(invitation.organisationId).select("imageUrl").lean();
        inviteeAvatarUrl = asTrimmedString(organisation?.imageUrl) || inviteeAvatarUrl;
    }

    const responseItem = {
        eventId: invitation.eventId,
        eventTitle: asTrimmedString(invitation?.eventTitle).slice(0, 120),
        inviteeUser: inviteeProfile.user,
        inviteeName,
        inviteeAvatarUrl,
        response: action,
        respondedAt: new Date(),
    };

    const inviterProfile = await Profile.findOne({ user: inviterUserId });
    if (inviterProfile) {
        const existingResponses = Array.isArray(inviterProfile.coHostInvitationResponses)
            ? inviterProfile.coHostInvitationResponses
            : [];
        inviterProfile.coHostInvitationResponses = [responseItem, ...existingResponses].slice(0, 30);
        await inviterProfile.save();
        return;
    }

    await Profile.create({
        user: inviterUserId,
        coHostInvitationResponses: [responseItem],
    });
};
