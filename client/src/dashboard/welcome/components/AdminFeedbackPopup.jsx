import { useState } from 'react';

const FEEDBACK_MESSAGE_MAX_WORDS = 200;

const countWords = (value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) return 0;
    return normalized.split(/\s+/).filter(Boolean).length;
};

export default function AdminFeedbackPopup({
    isOpen,
    apiUrl,
    onClose,
}) {
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState('');

    const wordCount = countWords(feedbackMessage);

    const resetState = () => {
        setFeedbackMessage('');
        setIsSubmitting(false);
        setIsSubmitted(false);
        setError('');
    };

    const handleClose = () => {
        resetState();
        if (typeof onClose === 'function') {
            onClose();
        }
    };

    const handleMessageChange = (event) => {
        const nextValue = typeof event?.target?.value === 'string' ? event.target.value : '';
        if (countWords(nextValue) <= FEEDBACK_MESSAGE_MAX_WORDS) {
            setFeedbackMessage(nextValue);
            setError('');
        }
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;

        const normalizedMessage = String(feedbackMessage || '').trim();
        if (!normalizedMessage) {
            setError('Please provide a message before sending.');
            return;
        }

        setError('');
        setIsSubmitting(true);

        try {
            const response = await fetch(`${apiUrl}/api/feedback/admins`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: normalizedMessage,
                }),
            });

            const data = await response.json();
            if (!response.ok || !data?.success) {
                throw new Error(data?.message || 'Unable to send feedback.');
            }

            setIsSubmitted(true);
        } catch (submitError) {
            setError(submitError.message || 'Unable to send feedback.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="contact-popup-overlay" role="presentation" onClick={handleClose}>
            <div
                className="contact-popup"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-feedback-popup-title"
                onClick={(event) => event.stopPropagation()}
            >
                <button className="contact-popup-close" type="button" onClick={handleClose} aria-label="Close">
                    x
                </button>

                {isSubmitted ? (
                    <div className="contact-popup-confirmation">
                        <h2 id="admin-feedback-popup-title" className="contact-popup-title contact-popup-success-title">
                            Feedback sent
                        </h2>
                        <p className="contact-popup-description contact-popup-success-description">
                            Thanks for your feedback. Your message has been sent to the Swinggity admin team.
                        </p>
                        <div className="contact-popup-actions contact-popup-success-actions">
                            <button type="button" className="contact-popup-submit" onClick={handleClose}>
                                Close
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h2 id="admin-feedback-popup-title" className="contact-popup-title">
                            Send feedback to <span>Swinggity Team</span>
                        </h2>

                        <p className="contact-popup-description">
                            Your message will be emailed to the Swinggity Team and we will get back to you as soon as possible.
                        </p>

                        <label className="contact-popup-label" htmlFor="admin-feedback-message">
                            Your message <small>(max {FEEDBACK_MESSAGE_MAX_WORDS} words)</small>
                        </label>
                        <textarea
                            id="admin-feedback-message"
                            className="contact-popup-textarea"
                            value={feedbackMessage}
                            onChange={handleMessageChange}
                            placeholder="Share your feedback, suggestion, or issue."
                        />
                        <p className="contact-popup-count">{wordCount} / {FEEDBACK_MESSAGE_MAX_WORDS} words</p>

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
