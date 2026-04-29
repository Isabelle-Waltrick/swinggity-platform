// The code in this file were created with help of AI (Copilot)

import CalendarEventCard from '../calendar/components/CalendarEventCard';
import { buildCalendarEventCardModel } from '../calendar/utils/eventCard';
import { isEventActivityType } from '../utils/activityFeed';

/**
 * ProfileActivityFeed:
 * Renders mixed activity entries for profile pages. Event activities are transformed
 * into CalendarEventCard rows, while non-event entries render as timestamped text.
 */
export default function ProfileActivityFeed({
    activityFeed,
    activityEventsById,
    apiUrl,
    currentUserId,
    currentUserRole,
    canMarkGoing,
    onViewEvent,
    onMarkGoing,
    onOrganizerClick,
    canEditEvent = false,
    canDeleteEvent = false,
    onEditEvent,
    onDeleteEvent,
    isDeletingEventId = '',
    goingEventIds = [],
    emptyMessage = 'No public activity to show yet.',
}) {
    // Ensure downstream rendering logic always works with an array.
    const normalizedFeed = Array.isArray(activityFeed) ? activityFeed : [];

    // Fast empty state when no activity items are available.
    if (normalizedFeed.length === 0) {
        return <p className="profile-copy">{emptyMessage}</p>;
    }

    // Convert raw feed items into renderable list nodes and drop invalid rows.
    const renderedItems = normalizedFeed
        .map((item, index) => {
            const itemType = typeof item?.type === 'string' ? item.type.trim() : '';
            const itemEntityId = String(item?.entityId || '').trim();

            // Event activities use dedicated event-card rendering.
            if (isEventActivityType(itemType) && item?.entityType === 'event') {
                if (itemType === 'event.deleted' || !itemEntityId) return null;

                const event = activityEventsById?.[itemEntityId];
                if (!event) return null;

                // Normalize event payload to the card display model consumed by CalendarEventCard.
                const cardEvent = buildCalendarEventCardModel(event, apiUrl, currentUserId, currentUserRole);

                return (
                    <li key={`${itemEntityId}-${index}`} className="profile-activity-item profile-activity-item-event">
                        <CalendarEventCard
                            event={cardEvent}
                            canMarkGoing={canMarkGoing}
                            canEditEvent={canEditEvent && Boolean(cardEvent.isEditable)}
                            canDeleteEvent={canDeleteEvent && Boolean(cardEvent.isDeletable)}
                            onEdit={onEditEvent}
                            onDelete={onDeleteEvent}
                            onView={onViewEvent}
                            onOrganizerClick={onOrganizerClick}
                            onGoing={onMarkGoing}
                            isDeleting={isDeletingEventId === itemEntityId}
                            isGoingPending={goingEventIds.includes(itemEntityId)}
                        />
                    </li>
                );
            }

            // Non-event activity rows render plain message text + optional timestamp.
            const createdAt = item?.createdAt ? new Date(item.createdAt) : null;
            const hasValidDate = createdAt && !Number.isNaN(createdAt.getTime());

            return (
                <li key={`${item?.entityId || item?.message || 'activity'}-${index}`} className="profile-activity-item">
                    <p className="profile-copy">{item.message}</p>
                    {hasValidDate ? (
                        <small className="profile-activity-time">
                            {createdAt.toLocaleString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </small>
                    ) : null}
                </li>
            );
        })
        .filter(Boolean);

    // If all rows were filtered out, fall back to empty state.
    if (renderedItems.length === 0) {
        return <p className="profile-copy">{emptyMessage}</p>;
    }

    return (
        // Final activity feed list consumed by profile sections.
        <ul className="profile-activity-feed" aria-label="Recent activity">
            {renderedItems}
        </ul>
    );
}
