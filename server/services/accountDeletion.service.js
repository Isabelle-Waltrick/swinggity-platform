// The code in this file were created with help of AI (Copilot)

import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { Organisation } from '../models/organisation.model.js';
import { CalendarEvent } from '../models/calendarEvent.model.js';
import { deleteAvatarAsset } from './mediaStorage.service.js';
import { deleteEventImageAsset } from './calendar.media.service.js';

/**
 * deleteUserAndRelatedDataByUserId: handles this function's core responsibility.
 */
export const deleteUserAndRelatedDataByUserId = async (rawUserId) => {
    // Guard clauses and normalization keep request handling predictable.
    const userId = String(rawUserId || '');
    // First, load everything we may need to clean up in one go.
    // Doing this up front keeps the rest of the flow straightforward.
    const [user, profile, organisation, ownedEvents] = await Promise.all([
        User.findById(userId),
        Profile.findOne({ user: userId }),
        Organisation.findOne({ user: userId }),
        CalendarEvent.find({ createdBy: userId }).select('imageUrl imageStorageId').lean(),
    ]);
    // If the user record is already gone, we treat this as "not found" and stop early.
    if (!user) return { found: false };
    // We collect storage cleanup promises first and run them together.
    // That keeps the flow readable and avoids serial asset deletion.
    const cleanupTasks = [];
    // Profile avatars are user-owned media, so clean that up if present.
    if (profile) {
        cleanupTasks.push(deleteAvatarAsset({
            avatarUrl: profile.avatarUrl,
            avatarStorageId: profile.avatarStorageId,
        }));
    }
    // If they own an organisation, its avatar belongs in the same cleanup pass.
    if (organisation) {
        cleanupTasks.push(deleteAvatarAsset({
            avatarUrl: organisation.imageUrl,
            avatarStorageId: organisation.imageStorageId,
        }));
    }
    // Event images are also external assets, so remove those too.
    for (const event of ownedEvents) {
        cleanupTasks.push(deleteEventImageAsset({
            imageUrl: event.imageUrl,
            imageStorageId: event.imageStorageId,
        }));
    }
    // Run file/media cleanup in parallel so deletion stays fast.
    await Promise.all(cleanupTasks);

    if (organisation) {
        // If the user owns an organisation, delete it and remove pending invites that point to it.
        await Organisation.deleteOne({ _id: organisation._id });
        await Profile.updateMany(
            { 'pendingOrganisationInvitations.organisationId': organisation._id },
            {
                $pull: {
                    pendingOrganisationInvitations: {
                        organisationId: organisation._id,
                    },
                },
            }
        );
    }
    // Remove the deleted user from relationship and invitation arrays on other profiles.
    // This prevents dangling references in member lists, invites, and response notifications.
    await Promise.all([
        Profile.updateMany({ jamCircleMembers: userId }, { $pull: { jamCircleMembers: userId } }),
        Profile.updateMany({ blockedMembers: userId }, { $pull: { blockedMembers: userId } }),
        Profile.updateMany({ 'pendingCircleInvitations.invitedBy': userId }, { $pull: { pendingCircleInvitations: { invitedBy: userId } } }),
        Profile.updateMany({ 'pendingCoHostInvitations.invitedBy': userId }, { $pull: { pendingCoHostInvitations: { invitedBy: userId } } }),
        Profile.updateMany({ 'coHostInvitationResponses.inviteeUser': userId }, { $pull: { coHostInvitationResponses: { inviteeUser: userId } } }),
        Profile.updateMany({ 'pendingOrganisationInvitations.invitedBy': userId }, { $pull: { pendingOrganisationInvitations: { invitedBy: userId } } }),
        Profile.updateMany({ 'organisationInvitationResponses.inviteeUser': userId }, { $pull: { organisationInvitationResponses: { inviteeUser: userId } } }),
    ]);
    // Final pass: remove the user's own domain records.
    await Promise.all([
        CalendarEvent.deleteMany({ createdBy: userId }),
        Profile.deleteOne({ user: userId }),
        User.deleteOne({ _id: userId }),
    ]);
    return { found: true };
};
