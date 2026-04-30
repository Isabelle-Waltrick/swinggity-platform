// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Lookup Service Guide
 * This service resolves profile and organisation display metadata in batches.
 * It powers avatar/name/circle/org maps used for response decoration.
 * Great for explaining how we avoid N+1 style lookup patterns.
 */

import mongoose from "mongoose";
import { Profile } from "../models/profile.model.js";
import { Organisation } from "../models/organisation.model.js";
import {
    asTrimmedString,
    buildUserDisplayName,
    getIdSet,
    normalizeAttendeeAvatar,
} from "../validators/calendar.utils.js";

export const getProfileAvatarByUserId = async (userId) => {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId || !mongoose.Types.ObjectId.isValid(normalizedUserId)) return "";

    const profile = await Profile.findOne({ user: normalizedUserId }).select("avatarUrl").lean(); // DBSR04: only the required field is fetched
    return normalizeAttendeeAvatar(profile?.avatarUrl);
};

export const getProfileDisplayNameByUserId = async (userId) => {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId || !mongoose.Types.ObjectId.isValid(normalizedUserId)) return "";

    const profile = await Profile.findOne({ user: normalizedUserId })
        .select("displayFirstName displayLastName") // DBSR04: only display name fields are fetched
        .lean();

    return buildUserDisplayName(profile?.displayFirstName, profile?.displayLastName, "");
};

export const getProfileAvatarMapByUserIds = async (userIds) => {
    const normalizedUserIds = [...new Set(
        (Array.isArray(userIds) ? userIds : [])
            .map((userId) => String(userId || "").trim())
            .filter((userId) => userId && mongoose.Types.ObjectId.isValid(userId))
    )];

    if (normalizedUserIds.length === 0) return {};

    const profiles = await Profile.find({ user: { $in: normalizedUserIds } })
        .select("user avatarUrl") // DBSR04: only the avatar and user ID are fetched
        .lean();

    return profiles.reduce((accumulator, profile) => {
        const ownerId = String(profile?.user || "").trim();
        if (!ownerId) return accumulator;
        accumulator[ownerId] = normalizeAttendeeAvatar(profile?.avatarUrl);
        return accumulator;
    }, {});
};

export const getProfileDisplayNameMapByUserIds = async (userIds) => {
    const normalizedUserIds = [...new Set(
        (Array.isArray(userIds) ? userIds : [])
            .map((userId) => String(userId || "").trim())
            .filter((userId) => userId && mongoose.Types.ObjectId.isValid(userId))
    )];

    if (normalizedUserIds.length === 0) return {};

    const profiles = await Profile.find({ user: { $in: normalizedUserIds } })
        .select("user displayFirstName displayLastName") // DBSR04: only display name fields are fetched
        .lean();

    return profiles.reduce((accumulator, profile) => {
        const ownerId = String(profile?.user || "").trim();
        if (!ownerId) return accumulator;
        accumulator[ownerId] = buildUserDisplayName(profile?.displayFirstName, profile?.displayLastName, "");
        return accumulator;
    }, {});
};

export const getProfileJamCircleSetMapByUserIds = async (userIds) => {
    const normalizedUserIds = [...new Set(
        (Array.isArray(userIds) ? userIds : [])
            .map((userId) => String(userId || "").trim())
            .filter((userId) => userId && mongoose.Types.ObjectId.isValid(userId))
    )];

    if (normalizedUserIds.length === 0) return {};

    const profiles = await Profile.find({ user: { $in: normalizedUserIds } })
        .select("user jamCircleMembers") // DBSR04: only the jam circle membership list is fetched
        .lean();

    return profiles.reduce((accumulator, profile) => {
        const ownerId = String(profile?.user || "").trim();
        if (!ownerId) return accumulator;
        accumulator[ownerId] = getIdSet(profile?.jamCircleMembers);
        return accumulator;
    }, {});
};

export const getOrganisationSummaryMapByIds = async (organisationIds) => {
    const normalizedOrganisationIds = [...new Set(
        (Array.isArray(organisationIds) ? organisationIds : [])
            .map((organisationId) => String(organisationId || "").trim())
            .filter((organisationId) => organisationId && mongoose.Types.ObjectId.isValid(organisationId))
    )];

    if (normalizedOrganisationIds.length === 0) return {};

    const organisations = await Organisation.find({ _id: { $in: normalizedOrganisationIds } })
        .select("_id organisationName imageUrl") // DBSR04: only the fields needed for the summary card are fetched
        .lean();

    return organisations.reduce((accumulator, organisation) => {
        const id = String(organisation?._id || "").trim();
        if (!id) return accumulator;

        accumulator[id] = {
            organisationName: asTrimmedString(organisation?.organisationName),
            imageUrl: asTrimmedString(organisation?.imageUrl),
        };

        return accumulator;
    }, {});
};
