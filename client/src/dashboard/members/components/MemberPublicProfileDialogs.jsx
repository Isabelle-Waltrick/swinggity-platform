import MemberContactPopup from '../../../components/MemberContactPopup';

const PROFILE_REPORT_REASONS = [
    'Fake account',
    'Impersonation',
    'Harassment or bullying',
    'Hate speech or abusive content',
    'Spam or scam',
    'Inappropriate profile content',
    'Suspicious or misleading activity',
    'Underage user',
    'Other',
];

export default function MemberPublicProfileDialogs({
    apiUrl,
    currentUser,
    memberName,
    isMemberContactPopupOpen,
    contactTargetName,
    contactTargetUserId,
    onCloseMemberContactPopup,
    invitePopup,
    onCloseInvitePopup,
    isDeleteMemberPopupOpen,
    onCloseDeleteMemberPopup,
    deleteMemberConfirmation,
    onDeleteMemberConfirmationChange,
    deleteMemberError,
    isDeleteMemberConfirmationValid,
    isDeletingMemberAccount,
    onDeleteMemberAccount,
    isReportPopupOpen,
    onCloseReportPopup,
    reportReasons,
    onToggleReportReason,
    reportDetails,
    onReportDetailsChange,
    reportError,
    isSubmittingReport,
    onSubmitProfileReport,
}) {
    return (
        <>
            <MemberContactPopup
                isOpen={isMemberContactPopupOpen}
                targetName={contactTargetName}
                targetUserId={contactTargetUserId}
                currentUser={currentUser}
                apiUrl={apiUrl}
                onClose={onCloseMemberContactPopup}
            />

            {invitePopup.isOpen ? (
                <div
                    className="notification-response-popup-overlay"
                    role="presentation"
                    onClick={onCloseInvitePopup}
                >
                    <div
                        className="notification-response-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="member-invite-popup-title"
                        aria-describedby="member-invite-popup-description"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="member-invite-popup-title" className="notification-response-popup-title">
                            {invitePopup.title}
                        </h2>
                        <p id="member-invite-popup-description" className="notification-response-popup-description">
                            {invitePopup.message}
                        </p>
                        <div className="notification-response-popup-actions">
                            <button
                                type="button"
                                className="notification-response-popup-button"
                                onClick={onCloseInvitePopup}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {isDeleteMemberPopupOpen ? (
                <div className="contact-popup-overlay" role="presentation" onClick={onCloseDeleteMemberPopup}>
                    <div
                        className="contact-popup delete-member-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-member-popup-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="delete-member-popup-title" className="contact-popup-title">
                            Are you sure you want to <span>delete {memberName}&apos;s account</span>?
                        </h2>

                        <p className="delete-member-popup-description">
                            This will permanently delete {memberName}&apos;s Swinggity account. This action cannot be undone. If you are sure you want to delete {memberName}&apos;s account, type on the input: <strong>Yes, please delete this user's account account</strong>
                        </p>

                        <label className="delete-member-popup-label" htmlFor="delete-member-confirmation">
                            Type the confirmation phrase
                        </label>
                        <input
                            id="delete-member-confirmation"
                            className="delete-member-popup-input"
                            type="text"
                            value={deleteMemberConfirmation}
                            onChange={(event) => onDeleteMemberConfirmationChange(event.target.value)}
                            autoComplete="off"
                            autoFocus
                        />

                        {deleteMemberError ? <p className="delete-member-popup-error">{deleteMemberError}</p> : null}

                        <div className="contact-popup-actions">
                            <button
                                type="button"
                                className="contact-popup-submit delete-member-popup-submit"
                                onClick={onDeleteMemberAccount}
                                disabled={!isDeleteMemberConfirmationValid || isDeletingMemberAccount}
                            >
                                {isDeletingMemberAccount ? 'Deleting...' : 'Delete Member'}
                            </button>
                            <button
                                type="button"
                                className="contact-popup-cancel"
                                onClick={onCloseDeleteMemberPopup}
                                disabled={isDeletingMemberAccount}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {isReportPopupOpen ? (
                <div className="contact-popup-overlay" role="presentation" onClick={onCloseReportPopup}>
                    <div
                        className="contact-popup report-profile-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="report-profile-popup-title"
                        aria-describedby="report-profile-popup-description"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="report-profile-popup-title" className="contact-popup-title">Flag this profile</h2>
                        <p id="report-profile-popup-description" className="contact-popup-description report-profile-popup-description">
                            Let us know why you are flagging this profile. Your report will be reviewed by our team.
                        </p>

                        <div className="report-profile-reasons" role="group" aria-label="Flag reasons">
                            {PROFILE_REPORT_REASONS.map((reason) => {
                                const inputId = `profile-report-reason-${reason.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                                const isChecked = reportReasons.includes(reason);

                                return (
                                    <label key={reason} className="contact-popup-checkbox-item report-profile-checkbox-item" htmlFor={inputId}>
                                        <input
                                            id={inputId}
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => onToggleReportReason(reason)}
                                            disabled={isSubmittingReport}
                                        />
                                        <span>{reason}</span>
                                    </label>
                                );
                            })}
                        </div>

                        <label className="contact-popup-label" htmlFor="profile-report-details">Additional details</label>
                        <textarea
                            id="profile-report-details"
                            className="contact-popup-textarea report-profile-textarea"
                            placeholder="Please share any details that may help us review this profile."
                            value={reportDetails}
                            onChange={(event) => onReportDetailsChange(event.target.value)}
                            disabled={isSubmittingReport}
                        />

                        {reportError ? <p className="contact-popup-error">{reportError}</p> : null}

                        <div className="contact-popup-actions report-profile-popup-actions">
                            <button
                                type="button"
                                className="contact-popup-cancel"
                                onClick={onCloseReportPopup}
                                disabled={isSubmittingReport}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="contact-popup-submit"
                                onClick={onSubmitProfileReport}
                                disabled={isSubmittingReport}
                            >
                                {isSubmittingReport ? 'Submitting...' : 'Submit flag'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
