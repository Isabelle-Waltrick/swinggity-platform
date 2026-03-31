import { useCallback, useEffect, useRef, useState } from 'react';
import ProfileAvatar from '../../components/ProfileAvatar';
import bellDefaultIcon from '../../assets/bell-default.svg';
import './NotificationBell.css';

const NotificationBell = () => {
    const [invitations, setInvitations] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [respondingTokenHash, setRespondingTokenHash] = useState('');
    const bellRef = useRef(null);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const hasNotifications = invitations.length > 0;

    // Fetch pending invitations
    const fetchInvitations = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/auth/circle-invitations/pending`, {
                credentials: 'include',
            });
            const data = await response.json();

            if (response.ok && data.success) {
                setInvitations(Array.isArray(data.invitations) ? data.invitations : []);
            }
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

    const handleRespond = async (tokenHash, action) => {
        setRespondingTokenHash(tokenHash);
        try {
            const response = await fetch(`${API_URL}/api/auth/circle-invitations/respond-in-app`, {
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
                current.filter((invite) => invite.tokenHash !== tokenHash)
            );

            // Show feedback
            const message = action === 'accept'
                ? 'Invitation accepted!'
                : 'Invitation denied.';
            window.alert(message);
        } catch (error) {
            window.alert(error.message || 'Unable to respond to invitation');
        } finally {
            setRespondingTokenHash('');
        }
    };

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="notification-bell" ref={bellRef}>
            <button
                className="bell-button"
                onClick={toggleDropdown}
                aria-label={hasNotifications ? `${invitations.length} new invitation${invitations.length !== 1 ? 's' : ''}` : 'No new invitations'}
                title={hasNotifications ? `You have ${invitations.length} new invitation${invitations.length !== 1 ? 's' : ''}` : 'No new invitations'}
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
                            <p className="empty-message">No new invitations</p>
                        </div>
                    ) : (
                        <div className="notifications-content">
                            <div className="notifications-header">
                                <h3>Notification</h3>
                            </div>
                            <div className="notifications-list">
                                {invitations.map((invite) => (
                                    <div key={invite.tokenHash} className="notification-item">
                                        <div className="invite-header">
                                            <ProfileAvatar
                                                firstName={invite.inviterName?.split(' ')[0] || 'S'}
                                                lastName={invite.inviterName?.split(' ')[1] || 'M'}
                                                avatarUrl={invite.inviterAvatarUrl}
                                                size={40}
                                            />
                                            <div className="invite-info">
                                                <p className="inviter-name">{invite.inviterName || 'A Swinggity member'}</p>
                                                <p className="invite-text">invited you to their Jam Circle</p>
                                            </div>
                                        </div>
                                        <div className="invite-actions">
                                            <button
                                                className="action-btn accept"
                                                onClick={() => handleRespond(invite.tokenHash, 'accept')}
                                                disabled={respondingTokenHash === invite.tokenHash}
                                            >
                                                {respondingTokenHash === invite.tokenHash ? 'Accepting...' : 'Accept'}
                                            </button>
                                            <button
                                                className="action-btn deny"
                                                onClick={() => handleRespond(invite.tokenHash, 'deny')}
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
        </div>
    );
};

export default NotificationBell;
