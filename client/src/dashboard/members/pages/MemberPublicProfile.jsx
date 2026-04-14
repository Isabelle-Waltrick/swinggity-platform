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
import privacyNobodyIcon from '../../../assets/privacy-nobody.svg';
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
const DELETE_ACCOUNT_CONFIRMATION_TEXT = "Yes, please delete this user's account account";
const ROLE_LABELS = {
    regular: 'Regular',
    organiser: 'Organiser',
    admin: 'Admin',
};

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

const isEventActivityType = (value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized === 'event.created' || normalized === 'event.updated' || normalized === 'event.deleted';
};

const uniqueActivityFeed = (feed) => {
    const seenEventKeys = new Set();

    // Keep only the first entry for each event so edits do not show as duplicate cards.
    return (Array.isArray(feed) ? feed : []).filter((item) => {
        const itemType = typeof item?.type === 'string' ? item.type.trim() : '';
        const entityType = typeof item?.entityType === 'string' ? item.entityType.trim() : '';
        const entityId = String(item?.entityId || '').trim();

        if (isEventActivityType(itemType) && entityType === 'event' && entityId) {
            const eventKey = `${entityType}|${entityId}`;
            if (seenEventKeys.has(eventKey)) return false;
            seenEventKeys.add(eventKey);
        }

        return Boolean(typeof item?.message === 'string' ? item.message.trim() : '');
    });
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
    const [isAccessDenied, setIsAccessDenied] = useState(false);
    const [menuActionState, setMenuActionState] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activityEventsById, setActivityEventsById] = useState({});
    const [goingActivityEventIds, setGoingActivityEventIds] = useState([]);
    const [isMemberContactPopupOpen, setIsMemberContactPopupOpen] = useState(false);
    const [contactTargetName, setContactTargetName] = useState('');
    const [contactTargetUserId, setContactTargetUserId] = useState('');
    const [invitePopup, setInvitePopup] = useState({
        isOpen: false,
        title: '',
        message: '',
    });
    const [isDeleteMemberPopupOpen, setIsDeleteMemberPopupOpen] = useState(false);
    const [isDeletingMemberAccount, setIsDeletingMemberAccount] = useState(false);
    const [deleteMemberConfirmation, setDeleteMemberConfirmation] = useState('');
    const [deleteMemberError, setDeleteMemberError] = useState('');
    const [isReportPopupOpen, setIsReportPopupOpen] = useState(false);
    const [reportReasons, setReportReasons] = useState([]);
    const [reportDetails, setReportDetails] = useState('');
    const [reportError, setReportError] = useState('');
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [selectedMemberRole, setSelectedMemberRole] = useState('regular');
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
    const [isUpdatingMemberRole, setIsUpdatingMemberRole] = useState(false);
    const [memberRoleUpdateError, setMemberRoleUpdateError] = useState('');
    const [showContactBlockedHint, setShowContactBlockedHint] = useState(false);
    const [isJamCircleExpanded, setIsJamCircleExpanded] = useState(false);
    const menuRef = useRef(null);
    const roleDropdownRef = useRef(null);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const normalizedUserRole = String(user?.role || '').trim().toLowerCase();
    const isAdminUser = normalizedUserRole === 'admin';
    const canMarkGoing = normalizedUserRole !== 'admin';

    useEffect(() => {
        const fetchMemberProfile = async () => {
            setIsLoading(true);
            setError('');
            setIsAccessDenied(false);

            try {
                const response = await fetch(`${API_URL}/api/auth/members/${encodeURIComponent(String(id || ''))}/profile`, {
                    credentials: 'include',
                });
                const data = await response.json();

                if (!response.ok && response.status === 403 && data?.code === 'ACCESS_DENIED') {
                    setMember(null);
                    setIsAccessDenied(true);
                    return;
                }

                if (!response.ok || !data.success || !data.member) {
                    throw new Error(data.message || 'Unable to load member profile.');
                }

                setIsAccessDenied(false);
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
        const normalizedRole = String(member?.role || '').trim().toLowerCase();
        if (normalizedRole === 'regular' || normalizedRole === 'organiser' || normalizedRole === 'admin') {
            setSelectedMemberRole(normalizedRole);
        }
    }, [member?.role]);

    useEffect(() => {
        setIsJamCircleExpanded(false);
    }, [member?.userId]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedInsideHeaderActions = menuRef.current && menuRef.current.contains(event.target);
            const clickedInsideRoleDropdown = roleDropdownRef.current && roleDropdownRef.current.contains(event.target);

            if (!clickedInsideHeaderActions) {
                setIsMenuOpen(false);
            }

            if (!clickedInsideRoleDropdown) {
                setIsRoleDropdownOpen(false);
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
    const normalizedMemberRole = String(member?.role || '').trim().toLowerCase();
    const selectedMemberRoleLabel = ROLE_LABELS[selectedMemberRole] || 'Regular';
    const isContactBlocked = !isOrganisationProfile && !member?.isCurrentUser && member?.canContact === false;
    const isProfileRestricted = !isOrganisationProfile && member?.canViewProfile === false;
    const isDeleteMemberConfirmationValid = deleteMemberConfirmation.trim() === DELETE_ACCOUNT_CONFIRMATION_TEXT;

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

    const activityFeed = useMemo(() => uniqueActivityFeed(
        (Array.isArray(member?.activityFeed) ? member.activityFeed : [])
            .map((item) => ({
                ...item,
                message: typeof item?.message === 'string' ? item.message.trim() : '',
            }))
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

    const openInvitePopup = (title, message) => {
        setInvitePopup({
            isOpen: true,
            title,
            message,
        });
    };

    const closeInvitePopup = () => {
        setInvitePopup({
            isOpen: false,
            title: '',
            message: '',
        });
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

    const openReportPopup = () => {
        setIsMenuOpen(false);
        setIsReportPopupOpen(true);
        setReportReasons([]);
        setReportDetails('');
        setReportError('');
    };

    const closeReportPopup = () => {
        if (isSubmittingReport) return;
        setIsReportPopupOpen(false);
        setReportReasons([]);
        setReportDetails('');
        setReportError('');
    };

    const toggleReportReason = (reason) => {
        const normalizedReason = String(reason || '').trim();
        if (!normalizedReason) return;

        setReportReasons((currentReasons) => {
            if (currentReasons.includes(normalizedReason)) {
                return currentReasons.filter((item) => item !== normalizedReason);
            }
            return [...currentReasons, normalizedReason];
        });
        setReportError('');
    };

    const handleSubmitProfileReport = async () => {
        const memberId = String(member?.userId || '').trim();
        if (!memberId || isSubmittingReport) return;

        if (reportReasons.length === 0) {
            setReportError('Please choose at least one reason.');
            return;
        }

        setIsSubmittingReport(true);
        setReportError('');

        try {
            const response = await fetch(`${API_URL}/api/auth/members/${encodeURIComponent(memberId)}/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    reasons: reportReasons,
                    additionalDetails: reportDetails,
                }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to submit this profile report.');
            }

            setIsReportPopupOpen(false);
            setReportReasons([]);
            setReportDetails('');
            setReportError('');
            openInvitePopup('Flag submitted', 'Thanks for the report. Our team will review this profile.');
        } catch (submitError) {
            setReportError(submitError.message || 'Unable to submit this profile report.');
        } finally {
            setIsSubmittingReport(false);
        }
    };

    const handleDeleteMemberPlaceholder = () => {
        if (!isAdminUser || isOrganisationProfile || member?.isCurrentUser) return;
        setDeleteMemberConfirmation('');
        setDeleteMemberError('');
        setIsDeleteMemberPopupOpen(true);
    };

    const closeDeleteMemberPopup = () => {
        if (isDeletingMemberAccount) return;
        setIsDeleteMemberPopupOpen(false);
        setDeleteMemberConfirmation('');
        setDeleteMemberError('');
    };

    const handleAdminRoleSave = async () => {
        if (!isAdminUser || isOrganisationProfile || member?.isCurrentUser || !member?.userId || isUpdatingMemberRole) return;

        const nextRole = String(selectedMemberRole || '').trim().toLowerCase();
        if (!ROLE_LABELS[nextRole]) {
            setMemberRoleUpdateError('Invalid role selected.');
            return;
        }

        setIsUpdatingMemberRole(true);
        setMemberRoleUpdateError('');

        try {
            const response = await fetch(`${API_URL}/api/auth/members/${encodeURIComponent(String(member.userId))}/profile`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ role: nextRole }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to update member role.');
            }

            const updatedRole = String(data?.updatedMemberRole || nextRole).trim().toLowerCase();
            setMember((previous) => (previous ? { ...previous, role: updatedRole } : previous));
            setSelectedMemberRole(updatedRole);
        } catch (saveError) {
            setMemberRoleUpdateError(saveError.message || 'Unable to update member role.');
        } finally {
            setIsUpdatingMemberRole(false);
        }
    };

    const handleAdminRoleSelect = (role) => {
        const normalizedRole = String(role || '').trim().toLowerCase();
        if (!ROLE_LABELS[normalizedRole]) return;

        setSelectedMemberRole(normalizedRole);
        setMemberRoleUpdateError('');
        setIsRoleDropdownOpen(false);
    };

    const handleDeleteMemberAccount = async () => {
        const memberId = String(member?.userId || '').trim();
        if (!isDeleteMemberConfirmationValid || !memberId || isDeletingMemberAccount) return;

        setIsDeletingMemberAccount(true);
        setDeleteMemberError('');

        try {
            const response = await fetch(`${API_URL}/api/auth/members/${encodeURIComponent(memberId)}/account`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to delete member account.');
            }

            setIsDeleteMemberPopupOpen(false);
            setIsMenuOpen(false);
            navigate('/dashboard/members');
        } catch (error) {
            setDeleteMemberError(error.message || 'Unable to delete member account.');
        } finally {
            setIsDeletingMemberAccount(false);
        }
    };

    const handleInvite = async () => {
        if (isAdminUser) {
            openInvitePopup('Unable to invite', 'Admin accounts cannot add members to a Jam Circle.');
            return;
        }

        if (isViewedMemberAdmin) {
            openInvitePopup('Unable to invite', 'Admin accounts cannot be added to a Jam Circle.');
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
            openInvitePopup('All Set', 'Your invitation was sent.');
        } catch (inviteError) {
            openInvitePopup('Unable to send invitation', inviteError.message || 'Unable to send invitation.');
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

                        const cardEvent = buildCalendarEventCardModel(event, API_URL, user?._id, user?.role);

                        return (
                            <li key={`${itemEntityId}-${index}`} className="profile-activity-item profile-activity-item-event">
                                <CalendarEventCard
                                    event={cardEvent}
                                    canMarkGoing={canMarkGoing}
                                    canEditEvent={false}
                                    canDeleteEvent={Boolean(cardEvent.isDeletable)}
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

    if (isAccessDenied) {
        return (
            <section className="profile-page" aria-label="Public member profile access denied">
                <div className="profile-section">
                    <div className="profile-restricted-card" role="status" aria-live="polite">
                        <img src={privacyNobodyIcon} alt="Access denied" className="profile-restricted-icon" />
                        <p className="profile-restricted-text">Access Denied</p>
                    </div>
                </div>
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
                    {!isProfileRestricted ? (
                        <div className="profile-heading-row">
                            <p className="profile-copy">{member.bio || PLACEHOLDERS.bio}</p>
                        </div>
                    ) : null}
                    {!isProfileRestricted && socialKeys.length > 0 ? (
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
                                        <button
                                            type="button"
                                            className="profile-circle-menu-item"
                                            onClick={handleDeleteMemberPlaceholder}
                                            disabled={Boolean(member?.isCurrentUser)}
                                        >
                                            <span className="profile-circle-menu-item-content">
                                                <img src={blockIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                                {member?.isCurrentUser ? 'Cannot delete yourself here' : 'Delete Member'}
                                            </span>
                                        </button>
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
                                                onClick={openReportPopup}
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

            {isProfileRestricted ? (
                <div className="profile-section">
                    <div className="profile-restricted-card" role="status" aria-live="polite">
                        <img src={privacyNobodyIcon} alt="Restricted profile" className="profile-restricted-icon" />
                        <p className="profile-restricted-text">{getName(member)}&apos;s Profile has restrict view.</p>
                    </div>
                </div>
            ) : null}

            {!isOrganisationProfile && !isProfileRestricted ? (
                <div className="profile-section">
                    {isAdminUser && !member?.isCurrentUser ? (
                        <div className="profile-admin-role-editor" aria-label="Admin role controls">
                            <label htmlFor="member-role-select" className="profile-admin-role-label">Change role</label>
                            <div className="profile-admin-role-controls" ref={roleDropdownRef}>
                                <div className="profile-admin-role-dropdown">
                                    <button
                                        id="member-role-select"
                                        type="button"
                                        className={`profile-admin-role-trigger ${isRoleDropdownOpen ? 'open' : ''}`}
                                        onClick={() => setIsRoleDropdownOpen((currentState) => !currentState)}
                                        aria-expanded={isRoleDropdownOpen}
                                        aria-haspopup="listbox"
                                        disabled={isUpdatingMemberRole}
                                    >
                                        <span>{selectedMemberRoleLabel}</span>
                                        <span className="profile-admin-role-caret">▾</span>
                                    </button>

                                    {isRoleDropdownOpen ? (
                                        <div className="profile-admin-role-panel" role="listbox" aria-label="Select member role">
                                            {Object.entries(ROLE_LABELS).map(([role, label]) => (
                                                <button
                                                    key={role}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={selectedMemberRole === role}
                                                    className={`profile-admin-role-option ${selectedMemberRole === role ? 'active' : ''}`}
                                                    onClick={() => handleAdminRoleSelect(role)}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                                <button
                                    type="button"
                                    className="profile-admin-role-save"
                                    onClick={handleAdminRoleSave}
                                    disabled={isUpdatingMemberRole || selectedMemberRole === normalizedMemberRole}
                                >
                                    {isUpdatingMemberRole ? 'Saving...' : 'Save role'}
                                </button>
                            </div>
                            {memberRoleUpdateError ? <p className="profile-admin-role-error">{memberRoleUpdateError}</p> : null}
                        </div>
                    ) : null}
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

            {!isProfileRestricted ? (
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
            ) : null}

            {!isOrganisationProfile && !isProfileRestricted ? (
                <div className="profile-section">
                    <div className="profile-section-heading">
                        <h2>Activity</h2>
                    </div>
                    {renderActivityValue()}
                </div>
            ) : null}

            {!isOrganisationProfile ? (
                <>
                    <MemberContactPopup
                        isOpen={isMemberContactPopupOpen}
                        targetName={contactTargetName}
                        targetUserId={contactTargetUserId}
                        currentUser={user}
                        apiUrl={API_URL}
                        onClose={closeMemberContactPopup}
                    />

                    {invitePopup.isOpen ? (
                        <div
                            className="notification-response-popup-overlay"
                            role="presentation"
                            onClick={closeInvitePopup}
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
                                        onClick={closeInvitePopup}
                                    >
                                        OK
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {isDeleteMemberPopupOpen ? (
                        <div className="contact-popup-overlay" role="presentation" onClick={closeDeleteMemberPopup}>
                            <div
                                className="contact-popup delete-member-popup"
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="delete-member-popup-title"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <h2 id="delete-member-popup-title" className="contact-popup-title">
                                    Are you sure you want to <span>delete {getName(member)}&apos;s account</span>?
                                </h2>

                                <p className="delete-member-popup-description">
                                    This will permanently delete {getName(member)}&apos;s Swinggity account. This action cannot be undone. If you are sure you want to delete {getName(member)}&apos;s account, type on the input: <strong>Yes, please delete this user's account account</strong>
                                </p>

                                <label className="delete-member-popup-label" htmlFor="delete-member-confirmation">
                                    Type the confirmation phrase
                                </label>
                                <input
                                    id="delete-member-confirmation"
                                    className="delete-member-popup-input"
                                    type="text"
                                    value={deleteMemberConfirmation}
                                    onChange={(event) => {
                                        setDeleteMemberConfirmation(event.target.value);
                                        setDeleteMemberError('');
                                    }}
                                    autoComplete="off"
                                    autoFocus
                                />

                                {deleteMemberError ? <p className="delete-member-popup-error">{deleteMemberError}</p> : null}

                                <div className="contact-popup-actions">
                                    <button
                                        type="button"
                                        className="contact-popup-submit delete-member-popup-submit"
                                        onClick={handleDeleteMemberAccount}
                                        disabled={!isDeleteMemberConfirmationValid || isDeletingMemberAccount}
                                    >
                                        {isDeletingMemberAccount ? 'Deleting...' : 'Delete Member'}
                                    </button>
                                    <button
                                        type="button"
                                        className="contact-popup-cancel"
                                        onClick={closeDeleteMemberPopup}
                                        disabled={isDeletingMemberAccount}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {isReportPopupOpen ? (
                        <div className="contact-popup-overlay" role="presentation" onClick={closeReportPopup}>
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
                                                    onChange={() => toggleReportReason(reason)}
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
                                    onChange={(event) => {
                                        setReportDetails(event.target.value);
                                        setReportError('');
                                    }}
                                    disabled={isSubmittingReport}
                                />

                                {reportError ? <p className="contact-popup-error">{reportError}</p> : null}

                                <div className="contact-popup-actions report-profile-popup-actions">
                                    <button
                                        type="button"
                                        className="contact-popup-cancel"
                                        onClick={closeReportPopup}
                                        disabled={isSubmittingReport}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="contact-popup-submit"
                                        onClick={handleSubmitProfileReport}
                                        disabled={isSubmittingReport}
                                    >
                                        {isSubmittingReport ? 'Submitting...' : 'Submit flag'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </>
            ) : null}
        </section>
    );
}
