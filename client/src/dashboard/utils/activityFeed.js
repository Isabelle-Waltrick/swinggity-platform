export const isEventActivityType = (value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized === 'event.created' || normalized === 'event.updated' || normalized === 'event.deleted';
};

export const uniqueActivityFeed = (feed) => {
    const seenEventKeys = new Set();

    return (Array.isArray(feed) ? feed : []).filter((item) => {
        const itemType = typeof item?.type === 'string' ? item.type.trim() : '';
        const entityType = typeof item?.entityType === 'string' ? item.entityType.trim() : '';
        const entityId = String(item?.entityId || '').trim();

        if (isEventActivityType(itemType) && entityType === 'event' && entityId) {
            const eventKey = `${entityType}|${entityId}`;
            if (seenEventKeys.has(eventKey)) return false;
            seenEventKeys.add(eventKey);
        }

        return Boolean(typeof item?.message === 'string' ? item.message.trim() : '');
    });
};
