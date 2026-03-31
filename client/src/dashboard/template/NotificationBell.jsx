import { useCallback, useEffect, useRef, useState } from 'react';
import ProfileAvatar from '../../components/ProfileAvatar';
import bellDefaultIcon from '../../assets/bell-default.svg';
import './NotificationBell.css';

const NotificationBell = () => {
    const [invitations, setInvitations] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [respondingTokenHash, setRespondingTokenHash] = useState('');
    const [responsePopup, setResponsePopup] = useState({
        isOpen: false,
        title: '',
        message: '',
    });
    const bellRef = useRef(null);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const hasNotifications = invitations.length > 0;

    // Fetch pending invitations
    const fetchInvitations = useCallback(async () => {
        setIsLoading(true);
        try {
            const [circleResponse, coHostResponse] = await Promise.all([
                fetch(`${API_URL}/api/auth/circle-invitations/pending`, {
                    credentials: 'include',
                }),
                fetch(`${API_URL}/api/calendar/cohost-invitations/pending`, {
                    credentials: 'include',
                }),
            ]);

            const [circleData, coHostData] = await Promise.all([
                circleResponse.json(),
                coHostResponse.json(),
            ]);

            const circleInvites = circleResponse.ok && circleData.success
                ? (Array.isArray(circleData.invitations) ? circleData.invitations : []).map((item) => ({
                    ...item,
                    notificationType: 'circle',
                    inviteText: 'invited you to their Jam Circle',
                }))
                : [];
            const coHostInvites = coHostResponse.ok && coHostData.success
                ? (Array.isArray(coHostData.invitations) ? coHostData.invitations : [])
                : [];

            const merged = [...circleInvites, ...coHostInvites]
                .sort((left, right) => new Date(right?.invitedAt || 0).getTime() - new Date(left?.invitedAt || 0).getTime());
            setInvitations(merged);
        } catch (error) {
            console.error('Error fetching invitations:', error);
        } finally {
            setIsLoading(false);
        }
    }, [API_URL]);

    // Fetch on mount and set up polling
    useEffect(() => {
        fetchInvitations();

        const pollInterval = setInterval(() => {
            fetchInvitations();
        }, 30000); // Poll every 30 seconds

        return () => clearInterval(pollInterval);
    }, [fetchInvitations]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (bellRef.current && !bellRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleRespond = async (invite, action) => {
        const tokenHash = String(invite?.tokenHash || '');
        const notificationType = invite?.notificationType === 'cohost' ? 'cohost' : 'circle';
        if (!tokenHash) return;

        setRespondingTokenHash(tokenHash);
        try {
            const endpoint = notificationType === 'cohost'
                ? `${API_URL}/api/calendar/cohost-invitations/respond-in-app`
                : `${API_URL}/api/auth/circle-invitations/respond-in-app`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ tokenHash, action }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to respond to invitation');
            }

            // Remove invitation from list
            setInvitations((current) =>
                current.filter((item) => item.tokenHash !== tokenHash)
            );

            // Show feedback
            const message = action === 'accept'
                ? (notificationType === 'cohost' ? 'Co-host request accepted!' : 'Invitation accepted!')
                : (notificationType === 'cohost' ? 'Co-host request denied.' : 'Invitation denied.');
            setResponsePopup({
                isOpen: true,
                title: 'All Set',
                message,
            });
        } catch (error) {
            setResponsePopup({
                isOpen: true,
                title: 'Unable to respond',
                message: error.message || 'Unable to respond to invitation',
            });
        } finally {
            setRespondingTokenHash('');
        }
    };

    const closeResponsePopup = () => {
        setResponsePopup({
            isOpen: false,
            title: '',
            message: '',
        });
    };

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="notification-bell" ref={bellRef}>
            <button
                className="bell-button"
                onClick={toggleDropdown}
                aria-label={hasNotifications ? `${invitations.length} new invitation${invitations.length !== 1 ? 's' : ''}` : 'No new notifications'}
                title={hasNotifications ? `You have ${invitations.length} new invitation${invitations.length !== 1 ? 's' : ''}` : 'No new notifications'}
            >
                <img
                    src={bellDefaultIcon}
                    alt="Notifications"
                    className="bell-icon"
                />
                {hasNotifications && (
                    <span className="notification-badge">{invitations.length}</span>
                )}
            </button>

            {isOpen && (
                <div className="notifications-dropdown" onClick={(e) => e.stopPropagation()}>
                    {isLoading ? (
                        <div className="notifications-content">
                            <p className="loading-message">Loading invitations...</p>
                        </div>
                    ) : invitations.length === 0 ? (
                        <div className="notifications-content">
                            <p className="empty-message">No new notifications</p>
                        </div>
                    ) : (
                        <div className="notifications-content">
                            <div className="notifications-header">
                                <h3>Notification</h3>
                            </div>
                            <div className="notifications-list">
                                {invitations.map((invite) => (
                                    <div key={`${invite.notificationType || 'circle'}-${invite.tokenHash}`} className="notification-item">
                                        <div className="invite-header">
                                            <ProfileAvatar
                                                firstName={invite.inviterName?.split(' ')[0] || 'S'}
                                                lastName={invite.inviterName?.split(' ')[1] || 'M'}
                                                avatarUrl={invite.inviterAvatarUrl}
                                                size={40}
                                            />
                                            <div className="invite-info">
                                                <p className="inviter-name">{invite.inviterName || 'A Swinggity member'}</p>
                                                <p className="invite-text">{invite.inviteText || 'sent you a request'}</p>
                                            </div>
                                        </div>
                                        <div className="invite-actions">
                                            <button
                                                className="action-btn accept"
                                                onClick={() => handleRespond(invite, 'accept')}
                                                disabled={respondingTokenHash === invite.tokenHash}
                                            >
                                                {respondingTokenHash === invite.tokenHash ? 'Accepting...' : 'Accept'}
                                            </button>
                                            <button
                                                className="action-btn deny"
                                                onClick={() => handleRespond(invite, 'deny')}
                                                disabled={respondingTokenHash === invite.tokenHash}
                                            >
                                                {respondingTokenHash === invite.tokenHash ? 'Denying...' : 'Deny'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {responsePopup.isOpen && (
                <div
                    className="notification-response-popup-overlay"
                    role="presentation"
                    onClick={closeResponsePopup}
                >
                    <div
                        className="notification-response-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="notification-response-popup-title"
                        aria-describedby="notification-response-popup-description"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="notification-response-popup-title" className="notification-response-popup-title">
                            {responsePopup.title}
                        </h2>
                        <p id="notification-response-popup-description" className="notification-response-popup-description">
                            {responsePopup.message}
                        </p>
                        <div className="notification-response-popup-actions">
                            <button
                                type="button"
                                className="notification-response-popup-button"
                                onClick={closeResponsePopup}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
