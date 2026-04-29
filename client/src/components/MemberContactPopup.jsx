// The code in this file were created with help of AI (Copilot)

import { useMemo, useState } from 'react';

// Maximum message length enforced as a word count for consistent UX across devices.
const CONTACT_MESSAGE_MAX_WORDS = 200;

// Counts words in user text input; trims whitespace and ignores repeated spaces.
const countWords = (value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) return 0;
    return normalized.split(/\s+/).filter(Boolean).length;
};

/**
 * MemberContactPopup:
 * Modal flow that lets one member send a direct contact request to another,
 * including message content and preferred callback channels.
 */
export default function MemberContactPopup({
    isOpen,
    targetName,
    targetUserId,
    currentUser,
    apiUrl,
    onClose,
}) {
    // Form, async, and feedback state for the popup lifecycle.
    const [contactMessage, setContactMessage] = useState('');
    const [allowEmailContact, setAllowEmailContact] = useState(false);
    const [allowPhoneContact, setAllowPhoneContact] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState('');

    // Defensive fallback so UI always has a valid recipient label.
    const safeTargetName = useMemo(() => {
        const normalized = String(targetName || '').trim();
        return normalized || 'this user';
    }, [targetName]);

    // Live word counter shown below message textarea.
    const wordCount = countWords(contactMessage);

    // Resets popup state so each open starts from a clean form.
    const resetState = () => {
        setContactMessage('');
        setAllowEmailContact(false);
        setAllowPhoneContact(false);
        setIsSubmitting(false);
        setIsSubmitted(false);
        setError('');
    };

    // Close handler centralizes state reset + parent close callback.
    const handleClose = () => {
        resetState();
        if (typeof onClose === 'function') {
            onClose();
        }
    };

    // Enforces word limit and clears stale errors while user edits.
    const handleMessageChange = (event) => {
        const nextValue = typeof event?.target?.value === 'string' ? event.target.value : '';
        if (countWords(nextValue) <= CONTACT_MESSAGE_MAX_WORDS) {
            setContactMessage(nextValue);
            setError('');
        }
    };

    // Validates form state, submits request, and maps server result to UI feedback.
    const handleSubmit = async () => {
        if (isSubmitting) return;

        const normalizedMessage = String(contactMessage || '').trim();
        if (!normalizedMessage) {
            setError('Please provide a message before sending.');
            return;
        }

        if (!allowEmailContact && !allowPhoneContact) {
            setError('Choose at least one contact method.');
            return;
        }

        if (allowPhoneContact && !String(currentUser?.phoneNumber || '').trim()) {
            setError("You haven't provided your phone number. Please add your phone number on your profile edit or select Email");
            return;
        }

        const normalizedTargetUserId = String(targetUserId || '').trim();
        if (!normalizedTargetUserId) {
            setError('Unable to determine who to contact.');
            return;
        }

        setError('');
        setIsSubmitting(true);

        try {
            // Sends selected channels + message to member contact endpoint.
            const response = await fetch(`${apiUrl}/api/members/${encodeURIComponent(normalizedTargetUserId)}/contact`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: normalizedMessage,
                    allowEmailContact,
                    allowPhoneContact,
                }),
            });

            const data = await response.json();
            if (!response.ok || !data?.success) {
                throw new Error(data?.message || 'Unable to send message.');
            }

            setIsSubmitted(true);
        } catch (submitError) {
            setError(submitError.message || 'Unable to send message.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Do not mount modal when not open.
    if (!isOpen) return null;

    return (
        // Overlay click closes popup; inner dialog stops propagation.
        <div className="contact-popup-overlay" role="presentation" onClick={handleClose}>
            <div
                className="contact-popup"
                role="dialog"
                aria-modal="true"
                aria-labelledby="member-contact-popup-title"
                onClick={(event) => event.stopPropagation()}
            >
                {/* Explicit close button for keyboard and pointer users. */}
                <button className="contact-popup-close" type="button" onClick={handleClose} aria-label="Close">
                    x
                </button>

                {/* Success state replaces form after message is sent. */}
                {isSubmitted ? (
                    <div className="contact-popup-confirmation">
                        <h2 id="member-contact-popup-title" className="contact-popup-title contact-popup-success-title">
                            Message sent
                        </h2>
                        <p className="contact-popup-description contact-popup-success-description">
                            Your message has been sent to {safeTargetName}. They can reach out using the contact method(s) you selected.
                        </p>
                        <div className="contact-popup-actions contact-popup-success-actions">
                            <button type="button" className="contact-popup-submit" onClick={handleClose}>
                                Close
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Compose message state shown before submit. */}
                        <h2 id="member-contact-popup-title" className="contact-popup-title">
                            Send an Email to <span>{safeTargetName}</span>
                        </h2>

                        <label className="contact-popup-label" htmlFor="member-contact-message">
                            Your message <small>(max {CONTACT_MESSAGE_MAX_WORDS} words)</small>
                        </label>
                        <textarea
                            id="member-contact-message"
                            className="contact-popup-textarea"
                            value={contactMessage}
                            onChange={handleMessageChange}
                            placeholder=""
                        />
                        <p className="contact-popup-count">{wordCount} / {CONTACT_MESSAGE_MAX_WORDS} words</p>

                        <h3 className="contact-popup-contact-title">How can they contact you?</h3>
                        <p className="contact-popup-contact-description">
                            Choose at least one option. Your selected contact details (email and/or phone number) will be included in the email to {safeTargetName} so they can contact you directly.
                        </p>

                        <div className="contact-popup-checkbox-row">
                            {/* Sender chooses whether to share email and/or phone. */}
                            <label className="contact-popup-checkbox-item">
                                <input
                                    type="checkbox"
                                    checked={allowEmailContact}
                                    onChange={(event) => {
                                        setAllowEmailContact(event.target.checked);
                                        setError('');
                                    }}
                                />
                                <span>Email</span>
                            </label>

                            <label className="contact-popup-checkbox-item">
                                <input
                                    type="checkbox"
                                    checked={allowPhoneContact}
                                    onChange={(event) => {
                                        setAllowPhoneContact(event.target.checked);
                                        setError('');
                                    }}
                                />
                                <span>Phone Number</span>
                            </label>
                        </div>

                        {error ? <p className="contact-popup-error">{error}</p> : null}

                        <div className="contact-popup-actions">
                            <button
                                type="button"
                                className="contact-popup-submit"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Sending...' : 'Send message'}
                            </button>
                            <button type="button" className="contact-popup-cancel" onClick={handleClose}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

