// The code in this file were created with help of AI (Copilot)
/**
 * DeleteActivityEventModal
 *
 * Confirmation dialog shown before permanently deleting an activity event from
 * the profile feed. The modal is intentionally minimal — it has no text input
 * and only two outcomes: confirm or cancel.
 *
 * The overlay background also acts as a cancel target so the user can dismiss
 * by clicking outside the dialog box. `stopPropagation` on the inner card
 * prevents that dismiss from firing when the user clicks inside it.
 *
 * Both action buttons are disabled while `isDeleting` is true to prevent
 * double-submission during the async delete request.
 *
 * Props:
 *   isDeleting {boolean}  — True while the delete API call is in-flight;
 *                           disables buttons and shows a loading label.
 *   onCancel   {Function} — Callback to close the modal without taking action.
 *   onConfirm  {Function} — Callback that triggers the actual delete request.
 */
export default function DeleteActivityEventModal({
    isDeleting,
    onCancel,
    onConfirm,
}) {
    return (
        // Overlay — clicking the dimmed backdrop triggers onCancel
        <div className="contact-popup-overlay" role="presentation" onClick={onCancel}>

            {/* ── Dialog card ───────────────────────────────────────────────── */}
            {/* stopPropagation prevents clicks inside the card from bubbling up
                to the overlay and accidentally dismissing the dialog */}
            <div
                className="contact-popup delete-popup"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-activity-event-popup-title"
                onClick={(event) => event.stopPropagation()}
            >
                {/* ── Warning copy ──────────────────────────────────────────── */}
                <h2 id="delete-activity-event-popup-title" className="delete-popup-title">
                    Are you sure you want to delete this event? This Action can not be undone
                </h2>

                {/* ── Action buttons ────────────────────────────────────────── */}
                {/* Both buttons are disabled while isDeleting is true to prevent
                    double-submission or an accidental cancel mid-request */}
                <div className="delete-popup-actions">
                    <button
                        type="button"
                        className="delete-popup-confirm"
                        onClick={onConfirm}
                        disabled={isDeleting}
                    >
                        {/* Label switches to a loading indicator while the API call is in-flight */}
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