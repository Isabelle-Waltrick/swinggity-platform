import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import ProfileActivityFeed from '../../components/ProfileActivityFeed';
import editIcon from '../../../assets/edit.svg';
import instagramIcon from '../../../assets/instagram-icon.svg';
import facebookIcon from '../../../assets/facebook-icon.svg';
import youtubeIcon from '../../../assets/youtube-icon.svg';
import linkedinIcon from '../../../assets/likedin-icon.svg';
import websiteIcon from '../../../assets/website-icon.svg';
import ProfileAvatar from '../../../components/ProfileAvatar';
import { isEventActivityType, uniqueActivityFeed } from '../../utils/activityFeed';
import '../../calendar/styles/Calendar.css';
import './Profile.css';

const PLACEHOLDERS = {
    bio: 'No bio to show. Let other members know a hit more about your lovely self.',
    interests: 'No tags to show. Adding interests helps you to connect with other members.',
    activity: 'You haven\'t interacted in the platform yet. Your activities in the platform will be shown here.',
};

const TAG_COLORS = [
    'profile-tag-color-1',
    'profile-tag-color-2',
    'profile-tag-color-3',
    'profile-tag-color-4',
    'profile-tag-color-5',
];

const SOCIAL_PLATFORMS = [
    { key: 'instagram', label: 'Instagram', icon: instagramIcon },
    { key: 'facebook', label: 'Facebook', icon: facebookIcon },
    { key: 'youtube', label: 'YouTube', icon: youtubeIcon },
    { key: 'linkedin', label: 'LinkedIn', icon: linkedinIcon },
    { key: 'website', label: 'Website', icon: websiteIcon },
];

const normalizeSocialUrl = (rawUrl) => {
    if (typeof rawUrl !== 'string') return '';

    const trimmed = rawUrl.trim();
    if (!trimmed) return '';

    const prefixed = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, '')}`;

    try {
        const parsed = new URL(prefixed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '';
        }
        return parsed.toString();
    } catch {
        return '';
    }
};

export default function ProfilePage({ showEditControls = true }) {
    const { user, setAuthenticatedUser } = useAuth();
    const navigate = useNavigate();
    const [jamCircleMembers, setJamCircleMembers] = useState(Array.isArray(user?.jamCircleMembers) ? user.jamCircleMembers : []);
    const [isJamCircleExpanded, setIsJamCircleExpanded] = useState(false);
    const [isCircleLoading, setIsCircleLoading] = useState(true);
    const [actingMemberId, setActingMemberId] = useState('');
    const [activityEventsById, setActivityEventsById] = useState({});
    const [goingActivityEventIds, setGoingActivityEventIds] = useState([]);
    const [deletingActivityEventId, setDeletingActivityEventId] = useState('');
    const [pendingDeleteActivityEventId, setPendingDeleteActivityEventId] = useState('');
    const [isDeleteActivityPopupOpen, setIsDeleteActivityPopupOpen] = useState(false);
    const [activityDeleteError, setActivityDeleteError] = useState('');
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const normalizedUserRole = String(user?.role || '').trim().toLowerCase();
    const isAdminUser = normalizedUserRole === 'admin';
    const canMarkGoing = normalizedUserRole !== 'admin';

    const resolvedDisplayFirstName = user?.displayFirstName?.trim() || user?.firstName || '';
    const resolvedDisplayLastName = user?.displayLastName?.trim() || user?.lastName || '';

    const userName = useMemo(() => {
        const firstName = resolvedDisplayFirstName;
        const lastName = resolvedDisplayLastName;
        return `${firstName} ${lastName}`.trim() || 'New Member';
    }, [resolvedDisplayFirstName, resolvedDisplayLastName]);

    const displayPronouns = isAdminUser ? '' : (typeof user?.pronouns === 'string' ? user.pronouns.trim() : '');

    const initials = useMemo(() => {
        const first = resolvedDisplayFirstName[0] ?? '';
        const last = resolvedDisplayLastName[0] ?? '';
        return `${first}${last}`.toUpperCase() || 'NM';
    }, [resolvedDisplayFirstName, resolvedDisplayLastName]);

    const profileData = {
        bio: user?.bio ?? '',
    };

    const activityFeed = useMemo(() => uniqueActivityFeed(
        (Array.isArray(user?.activityFeed) ? user.activityFeed : [])
            .map((item) => ({
                ...item,
                message: typeof item?.message === 'string' ? item.message.trim() : '',
            }))
    ), [user?.activityFeed]);

    const activityEventIds = useMemo(() => ([...new Set(
        activityFeed
            .filter((item) => isEventActivityType(item?.type) && item?.entityType === 'event' && item?.type !== 'event.deleted')
            .map((item) => String(item?.entityId || '').trim())
            .filter(Boolean)
    )]), [activityFeed]);
    const activityEventIdsKey = activityEventIds.join('|');
    const hasHiddenJamCircleMembers = jamCircleMembers.length > 3;
    const visibleJamCircleMembers = isJamCircleExpanded ? jamCircleMembers : jamCircleMembers.slice(0, 3);

    useEffect(() => {
        if (isAdminUser) {
            setJamCircleMembers([]);
            setIsCircleLoading(false);
            return;
        }

        const fetchJamCircle = async () => {
            setIsCircleLoading(true);
            try {
                const response = await fetch(`${API_URL}/api/auth/profile/jam-circle`, {
                    credentials: 'include',
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load your Jam Circle.');
                }

                setJamCircleMembers(Array.isArray(data.members) ? data.members : []);
            } catch {
                setJamCircleMembers(Array.isArray(user?.jamCircleMembers) ? user.jamCircleMembers : []);
            } finally {
                setIsCircleLoading(false);
            }
        };

        fetchJamCircle();
    }, [API_URL, isAdminUser, user?.jamCircleMembers]);

    useEffect(() => {
        if (jamCircleMembers.length <= 3) {
            setIsJamCircleExpanded(false);
        }
    }, [jamCircleMembers.length]);

    useEffect(() => {
        let isCancelled = false;

        const fetchActivityEvents = async () => {
            if (activityEventIds.length === 0) {
                setActivityEventsById({});
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/calendar/events`, {
                    credentials: 'include',
                });
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load activity events.');
                }

                const allEvents = Array.isArray(data.events) ? data.events : [];
                const allowedIds = new Set(activityEventIds);
                const nextMap = allEvents.reduce((accumulator, event) => {
                    const eventId = String(event?.id || '').trim();
                    if (!eventId || !allowedIds.has(eventId)) return accumulator;
                    accumulator[eventId] = event;
                    return accumulator;
                }, {});

                if (!isCancelled) {
                    setActivityEventsById(nextMap);
                }
            } catch {
                if (!isCancelled) {
                    setActivityEventsById({});
                }
            }
        };

        fetchActivityEvents();

        return () => {
            isCancelled = true;
        };
    }, [API_URL, activityEventIds, activityEventIdsKey]);

    const profileTags = (Array.isArray(user?.profileTags) ? user.profileTags : [])
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean);

    const onlineLinks = SOCIAL_PLATFORMS
        .map((platform) => ({
            ...platform,
            href: normalizeSocialUrl(user?.[platform.key]),
        }))
        .filter((platform) => Boolean(platform.href));

    const goToEditPage = () => {
        navigate('/dashboard/profile/edit');
    };

    const avatarSrc = user?.avatarUrl
        ? (user.avatarUrl.startsWith('http') ? user.avatarUrl : `${API_URL}${user.avatarUrl}`)
        : '';

    const handleViewActivityEvent = (eventId) => {
        const normalizedEventId = String(eventId || '').trim();
        if (!normalizedEventId) return;
        navigate(`/dashboard/calendar/${encodeURIComponent(normalizedEventId)}`);
    };

    const handleEditActivityEvent = (eventId) => {
        const normalizedEventId = String(eventId || '').trim();
        if (!normalizedEventId) return;
        navigate(`/dashboard/calendar/edit/${encodeURIComponent(normalizedEventId)}`);
    };

    const requestDeleteActivityEvent = (eventId) => {
        const normalizedEventId = String(eventId || '').trim();
        if (!normalizedEventId || deletingActivityEventId) return;
        setPendingDeleteActivityEventId(normalizedEventId);
        setIsDeleteActivityPopupOpen(true);
        setActivityDeleteError('');
    };

    const closeDeleteActivityPopup = () => {
        if (deletingActivityEventId) return;
        setIsDeleteActivityPopupOpen(false);
        setPendingDeleteActivityEventId('');
    };

    const confirmDeleteActivityEvent = async () => {
        const eventId = String(pendingDeleteActivityEventId || '').trim();
        if (!eventId || deletingActivityEventId) return;

        setIsDeleteActivityPopupOpen(false);
        try {
            await handleDeleteActivityEvent(eventId);
        } finally {
            setPendingDeleteActivityEventId('');
        }
    };

    const handleDeleteActivityEvent = async (eventId) => {
        const normalizedEventId = String(eventId || '').trim();
        if (!normalizedEventId || deletingActivityEventId) return;

        setActivityDeleteError('');
        setDeletingActivityEventId(normalizedEventId);
        try {
            const response = await fetch(`${API_URL}/api/calendar/events/${encodeURIComponent(normalizedEventId)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to delete event.');
            }

            setActivityEventsById((current) => {
                const next = { ...current };
                delete next[normalizedEventId];
                return next;
            });

            setAuthenticatedUser((previous) => {
                if (!previous) return previous;

                const currentFeed = Array.isArray(previous.activityFeed) ? previous.activityFeed : [];
                const nextFeed = currentFeed.filter((item) => String(item?.entityId || '') !== normalizedEventId);

                return {
                    ...previous,
                    activityFeed: nextFeed,
                    activity: nextFeed
                        .map((item) => (typeof item?.message === 'string' ? item.message.trim() : ''))
                        .filter(Boolean)
                        .join('\n')
                        .slice(0, 1000),
                };
            });
        } catch (error) {
            setActivityDeleteError(error.message || 'Unable to delete event.');
        } finally {
            setDeletingActivityEventId('');
        }
    };

    const handleMarkActivityEventGoing = async (eventId) => {
        const normalizedEventId = String(eventId || '').trim();
        if (!canMarkGoing || !normalizedEventId || goingActivityEventIds.includes(normalizedEventId)) return;

        setGoingActivityEventIds((previous) => [...previous, normalizedEventId]);
        try {
            const response = await fetch(`${API_URL}/api/calendar/events/${encodeURIComponent(normalizedEventId)}/going`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success || !data.event) {
                throw new Error(data.message || 'Unable to mark attendance for this event.');
            }

            setActivityEventsById((current) => ({
                ...current,
                [normalizedEventId]: data.event,
            }));
        } catch (error) {
            window.alert(error.message || 'Unable to mark attendance for this event.');
        } finally {
            setGoingActivityEventIds((previous) => previous.filter((id) => id !== normalizedEventId));
        }
    };

    const renderSectionValue = (key) => {
        if (profileData[key]) {
            return <p className="profile-copy">{profileData[key]}</p>;
        }

        return <p className="profile-copy">{PLACEHOLDERS[key]}</p>;
    };

    return (
        <section className="profile-page" aria-label="My profile">
            <header className="profile-header">
                <div className="profile-avatar-wrap">
                    <div className="profile-avatar" aria-hidden="true">
                        {avatarSrc ? (
                            <img className="profile-avatar-image" src={avatarSrc} alt="Profile avatar" />
                        ) : (
                            initials
                        )}
                    </div>
                    {showEditControls ? (
                        <button type="button" className="edit-icon-btn avatar-edit" onClick={goToEditPage} aria-label="Edit profile">
                            <img src={editIcon} alt="" />
                        </button>
                    ) : null}
                </div>

                <div className="profile-header-copy">
                    <h1>
                        {userName}
                        {displayPronouns ? <span className="profile-name-pronouns"> ({displayPronouns})</span> : null}
                    </h1>
                    <div className="profile-heading-row">
                        {renderSectionValue('bio')}
                        {showEditControls ? (
                            <button type="button" className="edit-icon-btn" onClick={goToEditPage} aria-label="Edit bio">
                                <img src={editIcon} alt="" />
                            </button>
                        ) : null}
                    </div>
                    {onlineLinks.length > 0 ? (
                        <div className="profile-social-links" aria-label="Online Links">
                            {onlineLinks.map((platform) => (
                                <a
                                    key={platform.key}
                                    href={platform.href}
                                    className="profile-social-link"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={platform.label}
                                >
                                    <img src={platform.icon} alt="" />
                                </a>
                            ))}
                        </div>
                    ) : null}
                </div>
            </header>

            {!isAdminUser ? (
                <div className="profile-section">
                    <div className="profile-section-heading">
                        <h2>Your Jam Circle</h2>
                    </div>
                    {isCircleLoading ? (
                        <p className="profile-copy">Loading your Jam Circle...</p>
                    ) : jamCircleMembers.length === 0 ? (
                        <p className="profile-copy">
                            You don&apos;t have anyone in your Jam Circle yet. Explore the{' '}
                            <span className="profile-linkish">members</span> page and start connecting with fellow dancers!
                        </p>
                    ) : (
                        <div className="profile-circle-list" aria-label="Your jam circle members">
                            {visibleJamCircleMembers.map((member) => (
                                <article key={member.userId} className="profile-circle-row profile-circle-row-name-only">
                                    <div className="profile-circle-member">
                                        <button
                                            type="button"
                                            className="profile-circle-avatar-button"
                                            onClick={() => navigate(`/dashboard/members/${member.userId}`)}
                                            aria-label={`View ${member.fullName || 'member'} profile`}
                                        >
                                            <ProfileAvatar
                                                firstName={member.displayFirstName}
                                                lastName={member.displayLastName}
                                                avatarUrl={member.avatarUrl}
                                                size={52}
                                            />
                                        </button>
                                        <div className="profile-circle-member-main">
                                            <button
                                                type="button"
                                                className="profile-circle-name-button"
                                                onClick={() => navigate(`/dashboard/members/${member.userId}`)}
                                                aria-label={`View ${member.fullName || 'member'} profile`}
                                            >
                                                {member.fullName || 'Swinggity Member'}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                            {hasHiddenJamCircleMembers ? (
                                <button
                                    type="button"
                                    className="profile-circle-toggle-link"
                                    onClick={() => setIsJamCircleExpanded((current) => !current)}
                                >
                                    {isJamCircleExpanded ? 'Show fewer contacts' : 'View the whole Jam Circle'}
                                </button>
                            ) : null}
                        </div>
                    )}
                </div>
            ) : null}

            {!isAdminUser ? (
                <div className="profile-section">
                    <div className="profile-section-heading">
                        <h2>Your Interests</h2>
                        {showEditControls ? (
                            <button type="button" className="edit-icon-btn" onClick={goToEditPage} aria-label="Edit interests">
                                <img src={editIcon} alt="" />
                            </button>
                        ) : null}
                    </div>
                    {profileTags.length === 0 ? (
                        <p className="profile-copy">{PLACEHOLDERS.interests}</p>
                    ) : (
                        <div className="profile-tag-cloud" aria-label="Selected interests">
                            {profileTags.map((tag, index) => (
                                <span key={`${tag}-${index}`} className={`profile-tag-pill ${TAG_COLORS[index % TAG_COLORS.length]}`}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ) : null}

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Your Activity</h2>
                    {showEditControls ? (
                        <button type="button" className="edit-icon-btn" onClick={goToEditPage} aria-label="Edit activity">
                            <img src={editIcon} alt="" />
                        </button>
                    ) : null}
                </div>
                {activityDeleteError ? <p className="profile-save-error">{activityDeleteError}</p> : null}
                {activityFeed.length > 0 ? (
                    <ProfileActivityFeed
                        activityFeed={activityFeed}
                        activityEventsById={activityEventsById}
                        apiUrl={API_URL}
                        currentUserId={user?._id}
                        currentUserRole={user?.role}
                        canMarkGoing={canMarkGoing}
                        onViewEvent={handleViewActivityEvent}
                        onMarkGoing={handleMarkActivityEventGoing}
                        onOrganizerClick={(organizerId) => navigate(`/dashboard/members/${encodeURIComponent(organizerId)}`)}
                        canEditEvent={true}
                        canDeleteEvent={true}
                        onEditEvent={handleEditActivityEvent}
                        onDeleteEvent={requestDeleteActivityEvent}
                        isDeletingEventId={deletingActivityEventId}
                        goingEventIds={goingActivityEventIds}
                        emptyMessage={PLACEHOLDERS.activity}
                    />
                ) : (
                    <p className="profile-copy">{PLACEHOLDERS.activity}</p>
                )}
            </div>

            {isDeleteActivityPopupOpen ? (
                <div className="contact-popup-overlay" role="presentation" onClick={closeDeleteActivityPopup}>
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
                                onClick={confirmDeleteActivityEvent}
                                disabled={Boolean(deletingActivityEventId)}
                            >
                                {deletingActivityEventId ? 'Deleting...' : 'Delete Event'}
                            </button>
                            <button
                                type="button"
                                className="delete-popup-cancel"
                                onClick={closeDeleteActivityPopup}
                                disabled={Boolean(deletingActivityEventId)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}