import editIcon from '../../../assets/edit.svg';
import ProfileActivityFeed from '../../components/ProfileActivityFeed';

/**
 * ProfileActivitySection:
 * Renders the user's activity feed, its empty state, and the activity-related event actions.
 */
export default function ProfileActivitySection({
    activityDeleteError,
    activityEventsById,
    activityFeed,
    apiUrl,
    canMarkGoing,
    currentUserId,
    currentUserRole,
    emptyMessage,
    goingEventIds,
    isDeletingEventId,
    onDeleteEvent,
    onEdit,
    onEditEvent,
    onMarkGoing,
    onOrganizerClick,
    onViewEvent,
    showEditControls,
}) {
    return (
        <div className="profile-section">
            <div className="profile-section-heading">
                <h2>Your Activity</h2>
                {showEditControls ? (
                    <button type="button" className="edit-icon-btn" onClick={onEdit} aria-label="Edit activity">
                        <img src={editIcon} alt="" />
                    </button>
                ) : null}
            </div>
            {activityDeleteError ? <p className="profile-save-error">{activityDeleteError}</p> : null}
            {activityFeed.length > 0 ? (
                <ProfileActivityFeed
                    activityFeed={activityFeed}
                    activityEventsById={activityEventsById}
                    apiUrl={apiUrl}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                    canMarkGoing={canMarkGoing}
                    onViewEvent={onViewEvent}
                    onMarkGoing={onMarkGoing}
                    onOrganizerClick={onOrganizerClick}
                    canEditEvent={true}
                    canDeleteEvent={true}
                    onEditEvent={onEditEvent}
                    onDeleteEvent={onDeleteEvent}
                    isDeletingEventId={isDeletingEventId}
                    goingEventIds={goingEventIds}
                    emptyMessage={emptyMessage}
                />
            ) : (
                <p className="profile-copy">{emptyMessage}</p>
            )}
        </div>
    );
}