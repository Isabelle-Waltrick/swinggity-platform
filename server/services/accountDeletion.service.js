import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { Organisation } from '../models/organisation.model.js';
import { CalendarEvent } from '../models/calendarEvent.model.js';
import { deleteAvatarAsset, deleteEventAsset } from './mediaStorage.service.js';

export const deleteAccountDataByUserId = async (rawUserId) => {
    const userId = String(rawUserId || '');
    const [user, profile, organisation, ownedEvents] = await Promise.all([
        User.findById(userId),
        Profile.findOne({ user: userId }),
        Organisation.findOne({ user: userId }),
        CalendarEvent.find({ createdBy: userId }).select('imageUrl imageStorageId').lean(),
    ]);

    if (!user) return { found: false };

    const cleanupTasks = [];

    if (profile) {
        cleanupTasks.push(deleteAvatarAsset({
            avatarUrl: profile.avatarUrl,
            avatarStorageId: profile.avatarStorageId,
        }));
    }

    if (organisation) {
        cleanupTasks.push(deleteAvatarAsset({
            avatarUrl: organisation.imageUrl,
            avatarStorageId: organisation.imageStorageId,
        }));
    }

    for (const event of ownedEvents) {
        cleanupTasks.push(deleteEventAsset({
            imageUrl: event.imageUrl,
            imageStorageId: event.imageStorageId,
        }));
    }

    await Promise.all(cleanupTasks);

    if (organisation) {
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

    await Promise.all([
        Profile.updateMany({ jamCircleMembers: userId }, { $pull: { jamCircleMembers: userId } }),
        Profile.updateMany({ blockedMembers: userId }, { $pull: { blockedMembers: userId } }),
        Profile.updateMany({ 'pendingCircleInvitations.invitedBy': userId }, { $pull: { pendingCircleInvitations: { invitedBy: userId } } }),
    ]);

    await Promise.all([
        CalendarEvent.deleteMany({ createdBy: userId }),
        Profile.deleteOne({ user: userId }),
        User.deleteOne({ _id: userId }),
    ]);

    return { found: true };
};
