import { CheckCircle } from './CheckCircle';
import { RecycleBin } from './RecycleBin';
import editSquaredIcon from '../../../assets/edit-squared.svg';

const avatarFallbackColors = ['#d9d9d9', '#000000', '#5d5d5d'];

export default function CalendarEventCard({
    event,
    canMarkGoing = true,
    canEditEvent = false,
    canDeleteEvent = false,
    onEdit,
    onDelete,
    onView,
    onOrganizerClick,
    onGoing,
    onAttendeesClick,
    isDeleting = false,
    isGoingPending = false,
}) {
    const { date, organizer, organizerId, title, attendees, image, id, editedAtLabel, attendeeAvatars = [], attendeeProfiles = [], isGoing = false } = event;
    const visibleAvatars = avatarFallbackColors.map((fallbackColor, index) => {
        const avatarUrl = typeof attendeeAvatars[index] === 'string' ? attendeeAvatars[index] : '';
        return {
            key: `avatar-${id}-${index}`,
            avatarUrl,
            fallbackColor,
        };
    });
    const showManageActions = Boolean(canEditEvent || canDeleteEvent);

    return (
        <div className="event-card">
            <button
                type="button"
                className="event-image-wrapper"
                onClick={() => onView?.(id)}
                aria-label={`View ${title} event details`}
            >
                <img src={image} alt={title || 'Event'} className="event-image" />
            </button>

            <div className="event-content">
                <p className="event-date">{date}</p>
                {editedAtLabel ? <p className="event-edited-at">Edited at {editedAtLabel}</p> : null}

                <button
                    type="button"
                    className="event-title-button"
                    onClick={() => onView?.(id)}
                    aria-label={`View ${title} event details`}
                >
                    {title}
                </button>

                <p className="event-organizer">
                    <span>by </span>
                    {organizerId ? (
                        <button
                            type="button"
                            className="organizer-name organizer-name-button"
                            onClick={() => onOrganizerClick?.(organizerId)}
                        >
                            {organizer}
                        </button>
                    ) : (
                        <span className="organizer-name">{organizer}</span>
                    )}
                </p>

                <div className="event-attendees">
                    <button
                        type="button"
                        className="attendees-text attendees-trigger"
                        onClick={() => onAttendeesClick?.({ title, attendees: attendeeProfiles })}
                        aria-label={`View people going to ${title}`}
                    >
                        {attendees} attendees
                    </button>
                    <button
                        type="button"
                        className="avatar-stack avatar-stack-button"
                        onClick={() => onAttendeesClick?.({ title, attendees: attendeeProfiles })}
                        aria-label={`View people going to ${title}`}
                    >
                        {visibleAvatars.map((avatar) => (
                            <div
                                key={avatar.key}
                                className={`avatar ${avatar.avatarUrl ? 'avatar-has-image' : ''}`}
                                style={avatar.avatarUrl
                                    ? { backgroundImage: `url(${avatar.avatarUrl})` }
                                    : { backgroundColor: avatar.fallbackColor }}
                            ></div>
                        ))}
                    </button>
                </div>

                <div className="event-actions">
                    {showManageActions ? (
                        <>
                            <button type="button" className="link-view-event" onClick={() => onView?.(id)}>View event</button>
                            <div className="event-manage-actions">
                                {canEditEvent ? (
                                    <button className="btn-edit" type="button" onClick={() => onEdit?.(id)}>
                                        <img src={editSquaredIcon} alt="" className="btn-edit-icon" />
                                        <span>Edit</span>
                                    </button>
                                ) : null}
                                {canDeleteEvent ? (
                                    <button className="btn-delete" type="button" onClick={() => onDelete?.(id)} disabled={isDeleting}>
                                        <RecycleBin />
                                        <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                                    </button>
                                ) : null}
                            </div>
                        </>
                    ) : (
                        <>
                            {canMarkGoing ? (
                                <button
                                    className={`btn-going ${isGoing ? 'is-active' : ''}`}
                                    type="button"
                                    onClick={() => onGoing?.(id)}
                                    disabled={isGoingPending}
                                >
                                    <CheckCircle />
                                    <span>{isGoingPending ? 'Saving...' : 'Going'}</span>
                                </button>
                            ) : null}
                            <button type="button" className="link-view-event" onClick={() => onView?.(id)}>View event</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}