import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import MemberContactPopup from '../../../components/MemberContactPopup';
import ProfileAvatar from '../../../components/ProfileAvatar';
import CalendarEventCard from '../../calendar/components/CalendarEventCard';
import { buildCalendarEventCardModel } from '../../calendar/utils/eventCard';
import instagramIcon from '../../../assets/instagram-icon.svg';
import facebookIcon from '../../../assets/facebook-icon.svg';
import youtubeIcon from '../../../assets/youtube-icon.svg';
import linkedinIcon from '../../../assets/likedin-icon.svg';
import websiteIcon from '../../../assets/website-icon.svg';
import mailIcon from '../../../assets/mail-icon.svg';
import addNewCircleIcon from '../../../assets/add-new-circle.svg';
import removeIcon from '../../../assets/remove-icon.svg';
import blockIcon from '../../../assets/block-icon.svg';
import flagIcon from '../../../assets/flag-icon.svg';
import '../../calendar/styles/Calendar.css';
import '../pages/Members.css';
import '../../Profile/pages/Profile.css';

const PLACEHOLDERS = {
    bio: 'No bio to show.',
    interests: 'No tags to show.',
    activity: 'No public activity to show yet.',
};

const TAG_COLORS = [
    'profile-tag-color-1',
    'profile-tag-color-2',
    'profile-tag-color-3',
    'profile-tag-color-4',
    'profile-tag-color-5',
];

const SOCIAL_PLATFORMS = {
    instagram: { label: 'Instagram', icon: instagramIcon },
    facebook: { label: 'Facebook', icon: facebookIcon },
    youtube: { label: 'YouTube', icon: youtubeIcon },
    linkedin: { label: 'LinkedIn', icon: linkedinIcon },
    website: { label: 'Website', icon: websiteIcon },
};

const SOCIAL_KEYS = ['instagram', 'facebook', 'youtube', 'linkedin', 'website'];
const CONTACT_BLOCKED_MESSAGE = "Sorry, you can't contact this member due to their privacy settings.";

const isEventActivityType = (value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized === 'event.created' || normalized === 'event.updated' || normalized === 'event.deleted';
};

const getName = (member) => {
    const firstName = typeof member?.displayFirstName === 'string' ? member.displayFirstName.trim() : '';
    const lastName = typeof member?.displayLastName === 'string' ? member.displayLastName.trim() : '';
    return `${firstName} ${lastName}`.trim() || 'Swinggity Member';
};

export default function MemberPublicProfilePage() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [member, setMember] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [menuActionState, setMenuActionState] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activityEventsById, setActivityEventsById] = useState({});
    const [goingActivityEventIds, setGoingActivityEventIds] = useState([]);
    const [isMemberContactPopupOpen, setIsMemberContactPopupOpen] = useState(false);
    const [contactTargetName, setContactTargetName] = useState('');
    const [contactTargetUserId, setContactTargetUserId] = useState('');
    const [showContactBlockedHint, setShowContactBlockedHint] = useState(false);
    const [isJamCircleExpanded, setIsJamCircleExpanded] = useState(false);
    const menuRef = useRef(null);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const normalizedUserRole = String(user?.role || '').trim().toLowerCase();
    const isAdminUser = normalizedUserRole === 'admin';
    const canMarkGoing = normalizedUserRole !== 'admin';

    useEffect(() => {
        const fetchMemberProfile = async () => {
            setIsLoading(true);
            setError('');

            try {
                const response = await fetch(`${API_URL}/api/auth/members/${encodeURIComponent(String(id || ''))}/profile`, {
                    credentials: 'include',
                });
                const data = await response.json();

                if (!response.ok || !data.success || !data.member) {
                    throw new Error(data.message || 'Unable to load member profile.');
                }

                setMember(data.member);
            } catch (fetchError) {
                setError(fetchError.message || 'Unable to load member profile right now.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchMemberProfile();
    }, [API_URL, id]);

    useEffect(() => {
        setShowContactBlockedHint(false);
    }, [member?.userId]);

    useEffect(() => {
        setIsJamCircleExpanded(false);
    }, [member?.userId]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedInsideHeaderActions = menuRef.current && menuRef.current.contains(event.target);

            if (!clickedInsideHeaderActions) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const socialKeys = useMemo(() => {
        if (!member?.showOnlineLinks || !member?.onlineLinks || typeof member.onlineLinks !== 'object') return [];

        return SOCIAL_KEYS.filter((socialKey) => typeof member.onlineLinks[socialKey] === 'string' && member.onlineLinks[socialKey].trim().length > 0);
    }, [member]);

    const isOrganisationProfile = member?.entityType === 'organisation';
    const isViewedMemberAdmin = String(member?.role || '').trim().toLowerCase() === 'admin';
    const isContactBlocked = !isOrganisationProfile && !member?.isCurrentUser && member?.canContact === false;

    const profileTags = useMemo(() => {
        return Array.isArray(member?.tags)
            ? member.tags.map((tag) => (typeof tag === 'string' ? tag.trim() : '')).filter(Boolean)
            : [];
    }, [member]);

    const participantContacts = useMemo(() => {
        if (!isOrganisationProfile || !Array.isArray(member?.participantContacts)) return [];
        return member.participantContacts
            .map((entry) => ({
                userId: String(entry?.userId || '').trim(),
                entityType: entry?.entityType === 'organisation' ? 'organisation' : 'member',
                organisationId: String(entry?.organisationId || '').trim(),
                displayName: String(entry?.displayName || '').trim(),
                avatarUrl: String(entry?.avatarUrl || '').trim(),
            }))
            .filter((entry) => entry.userId && entry.displayName);
    }, [isOrganisationProfile, member]);

    const jamCircleMembers = useMemo(() => (
        Array.isArray(member?.jamCircleMembers) ? member.jamCircleMembers : []
    ), [member?.jamCircleMembers]);

    const hasHiddenJamCircleMembers = jamCircleMembers.length > 3;
    const visibleJamCircleMembers = isJamCircleExpanded ? jamCircleMembers : jamCircleMembers.slice(0, 3);

    useEffect(() => {
        if (jamCircleMembers.length <= 3) {
            setIsJamCircleExpanded(false);
        }
    }, [jamCircleMembers.length]);

    const activityFeed = useMemo(() => (
        (Array.isArray(member?.activityFeed) ? member.activityFeed : [])
            .map((item) => ({
                ...item,
                message: typeof item?.message === 'string' ? item.message.trim() : '',
            }))
            .filter((item) => Boolean(item.message))
    ), [member?.activityFeed]);

    const activityEventIds = useMemo(() => ([...new Set(
        activityFeed
            .filter((item) => isEventActivityType(item?.type) && item?.entityType === 'event' && item?.type !== 'event.deleted')
            .map((item) => String(item?.entityId || '').trim())
            .filter(Boolean)
    )]), [activityFeed]);

    const activityEventIdsKey = activityEventIds.join('|');

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

    const handleViewActivityEvent = (eventId) => {
        const normalizedEventId = String(eventId || '').trim();
        if (!normalizedEventId) return;
        navigate(`/dashboard/calendar/${encodeURIComponent(normalizedEventId)}`);
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

    const openSocialLink = (socialKey) => {
        const memberIdPart = encodeURIComponent(String(id || ''));
        const platformPart = encodeURIComponent(String(socialKey || ''));
        window.open(`${API_URL}/api/auth/members/${memberIdPart}/social/${platformPart}`, '_blank', 'noopener,noreferrer');
    };

    const openMemberContactPopup = (name, userId) => {
        setContactTargetName(String(name || '').trim() || 'this user');
        setContactTargetUserId(String(userId || '').trim());
        setIsMemberContactPopupOpen(true);
    };

    const handleBlockedContactAttempt = (event) => {
        event.preventDefault();
        setShowContactBlockedHint(true);
    };

    const closeMemberContactPopup = () => {
        setIsMemberContactPopupOpen(false);
        setContactTargetName('');
        setContactTargetUserId('');
    };

    const handlePlaceholderReport = () => {
        window.alert('Flag / Report profile action coming soon.');
    };

    const handleSuspendMemberPlaceholder = () => {
        window.alert('Suspend Member action coming soon.');
    };

    const handleDeleteMemberPlaceholder = () => {
        window.alert('Delete Member action coming soon.');
    };

    const handleInvite = async () => {
        if (isAdminUser) {
            window.alert('Admin accounts cannot add members to a Jam Circle.');
            return;
        }

        if (isViewedMemberAdmin) {
            window.alert('Admin accounts cannot be added to a Jam Circle.');
            return;
        }

        const memberId = String(member?.userId || '');
        if (!memberId || menuActionState) return;

        setMenuActionState('invite');
        try {
            const response = await fetch(`${API_URL}/api/auth/members/${encodeURIComponent(memberId)}/invite`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to send invitation.');
            }

            setIsMenuOpen(false);
            window.alert('Your invitation was sent.');
        } catch (inviteError) {
            window.alert(inviteError.message || 'Unable to send invitation.');
        } finally {
            setMenuActionState('');
        }
    };

    const handleRemoveFromJamCircle = async () => {
        const memberId = String(member?.userId || '');
        if (!memberId || menuActionState) return;

        setMenuActionState('remove');
        try {
            const response = await fetch(`${API_URL}/api/auth/profile/jam-circle/${encodeURIComponent(memberId)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to remove member from Jam Circle.');
            }

            setIsMenuOpen(false);
            window.alert('Member removed from your Jam Circle.');
        } catch (removeError) {
            window.alert(removeError.message || 'Unable to remove member from Jam Circle.');
        } finally {
            setMenuActionState('');
        }
    };

    const handleBlockMember = async () => {
        const memberId = String(member?.userId || '');
        if (!memberId || menuActionState) return;

        setMenuActionState('block');
        try {
            const response = await fetch(`${API_URL}/api/auth/profile/blocked-members/${encodeURIComponent(memberId)}`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to block member.');
            }

            setIsMenuOpen(false);
            navigate('/dashboard/members');
        } catch (blockError) {
            window.alert(blockError.message || 'Unable to block member.');
        } finally {
            setMenuActionState('');
        }
    };

    const renderActivityValue = () => {
        if (activityFeed.length > 0) {
            const renderedItems = activityFeed
                .map((item, index) => {
                    const itemType = typeof item?.type === 'string' ? item.type.trim() : '';
                    const itemEntityId = String(item?.entityId || '').trim();

                    if (isEventActivityType(itemType) && item?.entityType === 'event') {
                        if (itemType === 'event.deleted' || !itemEntityId) return null;

                        const event = activityEventsById[itemEntityId];
                        if (!event) return null;

                        const cardEvent = buildCalendarEventCardModel(event, API_URL, user?._id);

                        return (
                            <li key={`${itemEntityId}-${index}`} className="profile-activity-item profile-activity-item-event">
                                <CalendarEventCard
                                    event={cardEvent}
                                    canMarkGoing={canMarkGoing}
                                    canEditEvent={false}
                                    canDeleteEvent={false}
                                    onView={handleViewActivityEvent}
                                    onOrganizerClick={(organizerId) => navigate(`/dashboard/members/${encodeURIComponent(organizerId)}`)}
                                    onGoing={handleMarkActivityEventGoing}
                                    isGoingPending={goingActivityEventIds.includes(itemEntityId)}
                                />
                            </li>
                        );
                    }

                    const createdAt = item?.createdAt ? new Date(item.createdAt) : null;
                    const hasValidDate = createdAt && !Number.isNaN(createdAt.getTime());

                    return (
                        <li key={`${item?.entityId || item?.message || 'activity'}-${index}`} className="profile-activity-item">
                            <p className="profile-copy">{item.message}</p>
                            {hasValidDate ? (
                                <small className="profile-activity-time">
                                    {createdAt.toLocaleString('en-GB', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </small>
                            ) : null}
                        </li>
                    );
                })
                .filter(Boolean);

            if (renderedItems.length > 0) {
                return (
                    <ul className="profile-activity-feed" aria-label="Recent activity">
                        {renderedItems}
                    </ul>
                );
            }
        }

        const legacyActivity = typeof member?.activity === 'string' ? member.activity.trim() : '';
        if (legacyActivity) {
            return <p className="profile-copy">{legacyActivity}</p>;
        }

        return <p className="profile-copy">{PLACEHOLDERS.activity}</p>;
    };

    if (isLoading) {
        return <p className="members-info">Loading profile...</p>;
    }

    if (error) {
        return (
            <section className="members-page" aria-label="Public member profile">
                <p className="members-error">{error}</p>
            </section>
        );
    }

    if (!member) {
        return <p className="members-info">Member not found.</p>;
    }

    return (
        <section className="profile-page" aria-label="Public member profile">
            <header className="profile-header">
                <div className="profile-avatar-wrap">
                    <ProfileAvatar
                        firstName={member.displayFirstName}
                        lastName={member.displayLastName}
                        avatarUrl={member.avatarUrl}
                        size={156}
                    />
                </div>

                <div className="profile-header-copy">
                    <h1>
                        {getName(member)}
                        {!isOrganisationProfile && member.pronouns ? <span className="profile-name-pronouns"> ({member.pronouns})</span> : null}
                    </h1>
                    <div className="profile-heading-row">
                        <p className="profile-copy">{member.bio || PLACEHOLDERS.bio}</p>
                    </div>
                    {socialKeys.length > 0 ? (
                        <div className="profile-social-links" aria-label="Online Links">
                            {socialKeys.map((socialKey) => {
                                const social = SOCIAL_PLATFORMS[socialKey];
                                if (!social) return null;

                                return (
                                    <button
                                        key={socialKey}
                                        type="button"
                                        className="member-social-link"
                                        aria-label={social.label}
                                        onClick={() => openSocialLink(socialKey)}
                                    >
                                        <img src={social.icon} alt="" />
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                    {!isOrganisationProfile ? (
                        <div className="profile-public-actions" ref={menuRef}>
                            {isContactBlocked ? (
                                <span
                                    className={`profile-contact-tooltip-wrap ${showContactBlockedHint ? 'is-visible' : ''}`}
                                    aria-disabled="true"
                                    onMouseLeave={() => setShowContactBlockedHint(false)}
                                >
                                    <button
                                        type="button"
                                        className="profile-circle-btn profile-circle-btn-contact profile-circle-btn-contact-disabled"
                                        aria-disabled="true"
                                        onClick={handleBlockedContactAttempt}
                                        onFocus={() => setShowContactBlockedHint(true)}
                                        onBlur={() => setShowContactBlockedHint(false)}
                                    >
                                        <img src={mailIcon} alt="" aria-hidden="true" className="profile-circle-btn-icon" />
                                        Contact
                                    </button>
                                    <span className="profile-contact-tooltip" role="tooltip">
                                        {CONTACT_BLOCKED_MESSAGE}
                                    </span>
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    className="profile-circle-btn profile-circle-btn-contact"
                                    onClick={() => openMemberContactPopup(getName(member), member.userId)}
                                >
                                    <img src={mailIcon} alt="" aria-hidden="true" className="profile-circle-btn-icon" />
                                    Contact
                                </button>
                            )}
                            <button
                                type="button"
                                className={`profile-circle-btn profile-circle-btn-more ${isMenuOpen ? 'is-open' : ''}`}
                                onClick={() => setIsMenuOpen((currentState) => !currentState)}
                            >
                                More
                                <span className="profile-circle-btn-caret" aria-hidden="true" />
                            </button>
                            {isMenuOpen ? (
                                <div className="profile-circle-menu" role="menu" aria-label={`Actions for ${getName(member)}`}>
                                    {!member.isCurrentUser && !isAdminUser && !isViewedMemberAdmin ? (
                                        <button
                                            type="button"
                                            className="profile-circle-menu-item"
                                            onClick={handleInvite}
                                            disabled={menuActionState.length > 0}
                                        >
                                            <span className="profile-circle-menu-item-content">
                                                <img src={addNewCircleIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                                {menuActionState === 'invite' ? 'Sending...' : 'Add to the Jam Circle'}
                                            </span>
                                        </button>
                                    ) : null}
                                    {isAdminUser ? (
                                        <>
                                            <button
                                                type="button"
                                                className="profile-circle-menu-item"
                                                onClick={handleSuspendMemberPlaceholder}
                                            >
                                                <span className="profile-circle-menu-item-content">
                                                    <img src={blockIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                                    Suspend Member
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="profile-circle-menu-item"
                                                onClick={handleDeleteMemberPlaceholder}
                                            >
                                                <span className="profile-circle-menu-item-content">
                                                    <img src={blockIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                                    Delete Member
                                                </span>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                className="profile-circle-menu-item"
                                                onClick={handleRemoveFromJamCircle}
                                                disabled={menuActionState.length > 0}
                                            >
                                                <span className="profile-circle-menu-item-content">
                                                    <img src={removeIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                                    {menuActionState === 'remove' ? 'Removing...' : 'Remove from Jam Circle'}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="profile-circle-menu-item"
                                                onClick={handleBlockMember}
                                                disabled={menuActionState.length > 0}
                                            >
                                                <span className="profile-circle-menu-item-content">
                                                    <img src={blockIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                                    {menuActionState === 'block' ? 'Blocking...' : 'Block member'}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="profile-circle-menu-item"
                                                onClick={handlePlaceholderReport}
                                            >
                                                <span className="profile-circle-menu-item-content">
                                                    <img src={flagIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                                    Flag / Report profile
                                                </span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </header>

            {!isOrganisationProfile ? (
                <div className="profile-section">
                    <div className="profile-section-heading">
                        <h2>Jam Circle</h2>
                    </div>
                    {jamCircleMembers.length === 0 ? (
                        <p className="profile-copy">No members in this Jam Circle yet.</p>
                    ) : (
                        <div className="profile-circle-list" aria-label="Jam circle members">
                            {visibleJamCircleMembers.map((circleMember) => (
                                <article key={circleMember.userId} className="profile-circle-row profile-circle-row-name-only">
                                    <div className="profile-circle-member">
                                        <button
                                            type="button"
                                            className="profile-circle-avatar-button"
                                            onClick={() => navigate(`/dashboard/members/${circleMember.userId}`)}
                                            aria-label={`View ${circleMember.fullName || 'member'} profile`}
                                        >
                                            <ProfileAvatar
                                                firstName={circleMember.displayFirstName}
                                                lastName={circleMember.displayLastName}
                                                avatarUrl={circleMember.avatarUrl}
                                                size={52}
                                            />
                                        </button>
                                        <div className="profile-circle-member-main">
                                            <button
                                                type="button"
                                                className="profile-circle-name-button"
                                                onClick={() => navigate(`/dashboard/members/${circleMember.userId}`)}
                                                aria-label={`View ${circleMember.fullName || 'member'} profile`}
                                            >
                                                {circleMember.fullName || 'Swinggity Member'}
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

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>{isOrganisationProfile ? 'Participants' : 'Interests'}</h2>
                </div>
                {isOrganisationProfile ? (
                    participantContacts.length === 0 ? (
                        <p className="profile-copy">No participants to show.</p>
                    ) : (
                        <div className="calendar-view-contact-list" aria-label="Participant contacts">
                            {participantContacts.map((contact) => {
                                const displayLabel = `${contact.displayName}${contact.entityType === 'organisation' ? ' (Organisation)' : ''}`;
                                return (
                                    <div key={`${contact.userId}|${contact.entityType}|${contact.organisationId || ''}`} className="calendar-view-contact-item">
                                        <button
                                            type="button"
                                            className="calendar-view-profile-trigger"
                                            onClick={() => {
                                                const targetId = contact.entityType === 'organisation' ? contact.organisationId : contact.userId;
                                                if (targetId) navigate(`/dashboard/members/${encodeURIComponent(targetId)}`);
                                            }}
                                            aria-label={`Open ${displayLabel} profile`}
                                        >
                                            <ProfileAvatar
                                                firstName={contact.displayName.split(' ')[0] || ''}
                                                lastName={contact.displayName.split(' ').slice(1).join(' ') || ''}
                                                avatarUrl={contact.avatarUrl}
                                                size={42}
                                                className="calendar-view-contact-avatar"
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            className="calendar-view-name-link"
                                            onClick={() => {
                                                const targetId = contact.entityType === 'organisation' ? contact.organisationId : contact.userId;
                                                if (targetId) navigate(`/dashboard/members/${encodeURIComponent(targetId)}`);
                                            }}
                                        >
                                            {displayLabel}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : profileTags.length === 0 ? (
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

            {!isOrganisationProfile ? (
                <div className="profile-section">
                    <div className="profile-section-heading">
                        <h2>Activity</h2>
                    </div>
                    {renderActivityValue()}
                </div>
            ) : null}

            {!isOrganisationProfile ? (
                <MemberContactPopup
                    isOpen={isMemberContactPopupOpen}
                    targetName={contactTargetName}
                    targetUserId={contactTargetUserId}
                    currentUser={user}
                    apiUrl={API_URL}
                    onClose={closeMemberContactPopup}
                />
            ) : null}
        </section>
    );
}
