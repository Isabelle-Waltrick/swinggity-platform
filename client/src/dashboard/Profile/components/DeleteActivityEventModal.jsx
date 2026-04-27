/**
 * DeleteActivityEventModal:
 * Presents a confirmation dialog before removing an event from the profile
 * activity feed.
 */
export default function DeleteActivityEventModal({
    isDeleting,
    onCancel,
    onConfirm,
}) {
    return (
        <div className="contact-popup-overlay" role="presentation" onClick={onCancel}>
            <div
                className="contact-popup delete-popup"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-activity-event-popup-title"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 id="delete-activity-event-popup-title" className="delete-popup-title">
                    Are you sure you want to delete this event? This Action can not be undone
                </h2>

                <div className="delete-popup-actions">
                    <button
                        type="button"
                        className="delete-popup-confirm"
                        onClick={onConfirm}
                        disabled={isDeleting}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Event'}
                    </button>
                    <button
                        type="button"
                        className="delete-popup-cancel"
                        onClick={onCancel}
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}