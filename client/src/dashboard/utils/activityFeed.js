/**
 * isEventActivityType:
 * Answers the question: "Is this activity about a calendar event?"
 * Returns true if the activity type is event.created, event.updated, or event.deleted.
 */
export const isEventActivityType = (value) => {
    // Make sure we're working with a clean string — if it's not a string, treat it as empty.
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized === 'event.created' || normalized === 'event.updated' || normalized === 'event.deleted';
};

/**
 * uniqueActivityFeed:
 * Cleans up a raw activity feed list before showing it to the user. It does two things:
 * 1. Removes duplicate calendar event entries — if the same event appears more than once,
 *    only the first one is kept so the feed isn't cluttered.
 * 2. Removes blank entries — any item with no message text is thrown out since there's
 *    nothing useful to display.
 */
export const uniqueActivityFeed = (feed) => {
    // Keeps track of which events we've already added so we can skip duplicates.
    const seenEventKeys = new Set();

    // If feed isn't an array for some reason, treat it as empty to avoid crashes.
    return (Array.isArray(feed) ? feed : []).filter((item) => {
        // Pull out the key fields we need, defaulting to empty strings if anything is missing.
        const itemType = typeof item?.type === 'string' ? item.type.trim() : '';
        const entityType = typeof item?.entityType === 'string' ? item.entityType.trim() : '';
        const entityId = String(item?.entityId || '').trim();

        // If this is a calendar event activity, check if we've seen this event before.
        // If we have, skip it. If we haven't, record it so future duplicates get skipped.
        if (isEventActivityType(itemType) && entityType === 'event' && entityId) {
            const eventKey = `${entityType}|${entityId}`;
            if (seenEventKeys.has(eventKey)) return false;
            seenEventKeys.add(eventKey);
        }

        // Only keep this item if it actually has a message to show.
        return Boolean(typeof item?.message === 'string' ? item.message.trim() : '');
    });
};
