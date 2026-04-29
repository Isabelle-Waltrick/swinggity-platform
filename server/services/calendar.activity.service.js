// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Activity Service Guide
 * This service writes and cleans profile activity feed entries tied to events.
 * It keeps activity history logic separate from HTTP request handling.
 * Helpful when explaining user-facing activity timelines.
 */

import mongoose from "mongoose";
import { Profile } from "../models/profile.model.js";
import { asTrimmedString } from "../validators/calendar.utils.js";

export const buildActivityLine = (title, startDate, startTime) => {
    const date = asTrimmedString(startDate);
    const time = asTrimmedString(startTime);
    return `Created event: ${title} (${date} ${time})`;
};

const normalizeLegacyActivity = (activityText) => {
    const activity = asTrimmedString(activityText);
    if (!activity) return [];

    return activity
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 10)
        .map((line) => ({
            type: "legacy",
            entityType: "",
            entityId: null,
            message: line.slice(0, 220),
            createdAt: new Date(),
        }));
};

const dedupeProfileActivityFeed = (feed, entityType, entityId) => {
    const normalizedEntityType = asTrimmedString(entityType);
    const normalizedEntityId = String(entityId || "").trim();

    if (!normalizedEntityType || !normalizedEntityId) {
        return Array.isArray(feed) ? feed : [];
    }

    return (Array.isArray(feed) ? feed : []).filter((item) => !(
        asTrimmedString(item?.entityType) === normalizedEntityType
        && String(item?.entityId || "").trim() === normalizedEntityId
    ));
};

export const upsertProfileActivity = async (user, activityItem) => {
    const existingProfile = await Profile.findOne({ user: user._id });
    const normalizedActivityItem = {
        type: asTrimmedString(activityItem.type) || "event.activity",
        entityType: asTrimmedString(activityItem.entityType),
        entityId: activityItem.entityId && mongoose.Types.ObjectId.isValid(String(activityItem.entityId))
            ? activityItem.entityId
            : null,
        message: asTrimmedString(activityItem.message).slice(0, 220),
        createdAt: activityItem.createdAt instanceof Date ? activityItem.createdAt : new Date(),
    };

    const existingFeed = Array.isArray(existingProfile?.activityFeed)
        ? existingProfile.activityFeed
        : normalizeLegacyActivity(existingProfile?.activity);

    const nextFeed = [
        normalizedActivityItem,
        ...dedupeProfileActivityFeed(existingFeed, normalizedActivityItem.entityType, normalizedActivityItem.entityId),
    ].slice(0, 30);
    const legacyActivityText = nextFeed
        .map((item) => asTrimmedString(item?.message))
        .filter(Boolean)
        .join("\n")
        .slice(0, 1000);

    if (existingProfile) {
        existingProfile.activityFeed = nextFeed;
        existingProfile.activity = legacyActivityText;
        await existingProfile.save();
        return;
    }

    await Profile.create({
        user: user._id,
        displayFirstName: user.firstName,
        displayLastName: user.lastName,
        activity: legacyActivityText,
        activityFeed: nextFeed,
    });
};

export const removeEventActivityFromProfile = async (userId, eventId) => {
    const profile = await Profile.findOne({ user: userId });
    if (!profile) return;

    const currentFeed = Array.isArray(profile.activityFeed)
        ? profile.activityFeed
        : normalizeLegacyActivity(profile.activity);
    const nextFeed = currentFeed
        .filter((item) => !(
            asTrimmedString(item?.entityType) === "event"
            && String(item?.entityId || "") === String(eventId || "")
        ))
        .slice(0, 30);

    profile.activityFeed = nextFeed;
    profile.activity = nextFeed
        .map((item) => asTrimmedString(item?.message))
        .filter(Boolean)
        .join("\n")
        .slice(0, 1000);

    await profile.save();
};
