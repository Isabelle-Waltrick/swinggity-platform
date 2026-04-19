import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import ProfileAvatar from '../../../components/ProfileAvatar';
import OrganisationProfileSection from '../components/OrganisationProfileSection';
import useMemberPublicProfileActions from '../hooks/useMemberPublicProfileActions';
import MemberPublicProfileActions from '../components/MemberPublicProfileActions';
import MemberPublicProfileDialogs from '../components/MemberPublicProfileDialogs';
import ProfileActivityFeed from '../../components/ProfileActivityFeed';
import instagramIcon from '../../../assets/instagram-icon.svg';
import facebookIcon from '../../../assets/facebook-icon.svg';
import youtubeIcon from '../../../assets/youtube-icon.svg';
import linkedinIcon from '../../../assets/likedin-icon.svg';
import websiteIcon from '../../../assets/website-icon.svg';
import privacyNobodyIcon from '../../../assets/privacy-nobody.svg';
import { isEventActivityType, uniqueActivityFeed } from '../../utils/activityFeed';
import '../../calendar/styles/Calendar.css';
import '../pages/Members.css';
import '../../Profile/pages/Profile.css';

const PLACEHOLDERS = {
    bio: 'No bio to show.',
    interests: 'No tags to show.',
    events: 'No events to show yet.',
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
const ROLE_LABELS = {
    regular: 'Regular',
    organiser: 'Organiser',
    admin: 'Admin',
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
    const [activityEventsById, setActivityEventsById] = useState({});
    const [goingActivityEventIds, setGoingActivityEventIds] = useState([]);
    const [isJamCircleExpanded, setIsJamCircleExpanded] = useState(false);
    const menuRef = useRef(null);
    const roleDropdownRef = useRef(null);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const normalizedUserRole = String(user?.role || '').trim().toLowerCase();
    const isAdminUser = normalizedUserRole === 'admin';
    const canMarkGoing = normalizedUserRole !== 'admin';
    const isOrganisationProfile = member?.entityType === 'organisation';
    const isViewedMemberAdmin = String(member?.role || '').trim().toLowerCase() === 'admin';

    const {
        menuActionState,
        isMenuOpen,
        setIsMenuOpen,
        isMemberContactPopupOpen,
        contactTargetName,
        contactTargetUserId,
        invitePopup,
        isDeleteMemberPopupOpen,
        isDeletingMemberAccount,
        deleteMemberConfirmation,
        deleteMemberError,
        isReportPopupOpen,
        reportReasons,
        reportDetails,
        reportError,
        isSubmittingReport,
        selectedMemberRole,
        selectedMemberRoleLabel,
        normalizedMemberRole,
        isRoleDropdownOpen,
        setIsRoleDropdownOpen,
        isUpdatingMemberRole,
        memberRoleUpdateError,
        showContactBlockedHint,
        setShowContactBlockedHint,
        isDeleteMemberConfirmationValid,
        openSocialLink,
        openMemberContactPopup,
        closeMemberContactPopup,
        closeInvitePopup,
        handleBlockedContactAttempt,
        openReportPopup,
        closeReportPopup,
        toggleReportReason,
        handleSubmitProfileReport,
        handleDeleteMemberPlaceholder,
        closeDeleteMemberPopup,
        handleAdminRoleSave,
        handleAdminRoleSelect,
        handleDeleteMemberAccount,
        handleInvite,
        handleRemoveFromJamCircle,
        handleBlockMember,
        onDeleteMemberConfirmationChange,
        onReportDetailsChange,
    } = useMemberPublicProfileActions({
        apiUrl: API_URL,
        profileId: id,
        member,
        setMember,
        navigate,
        isAdminUser,
        isOrganisationProfile,
        isViewedMemberAdmin,
        roleLabels: ROLE_LABELS,
    });

    useEffect(() => {
        const fetchMemberProfile = async () => {
            setIsLoading(true);
            setError('');
            setIsAccessDenied(false);

            try {
                const response = await fetch(`${API_URL}/api/members/${encodeURIComponent(String(id || ''))}/profile`, {
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
    }, [setIsMenuOpen, setIsRoleDropdownOpen]);

    const socialKeys = useMemo(() => {
        if (!member?.showOnlineLinks || !member?.onlineLinks || typeof member.onlineLinks !== 'object') return [];

        return SOCIAL_KEYS.filter((socialKey) => typeof member.onlineLinks[socialKey] === 'string' && member.onlineLinks[socialKey].trim().length > 0);
    }, [member]);

    const memberName = getName(member);
    const isContactBlocked = !isOrganisationProfile && !member?.isCurrentUser && member?.canContact === false;
    const isProfileRestricted = !isOrganisationProfile && member?.canViewProfile === false;

    const profileTags = useMemo(() => {
        return Array.isArray(member?.tags)
            ? member.tags.map((tag) => (typeof tag === 'string' ? tag.trim() : '')).filter(Boolean)
            : [];
    }, [member]);

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
                        {memberName}
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
                        <MemberPublicProfileActions
                            menuRef={menuRef}
                            member={member}
                            memberName={memberName}
                            isContactBlocked={isContactBlocked}
                            showContactBlockedHint={showContactBlockedHint}
                            onHideContactBlockedHint={() => setShowContactBlockedHint(false)}
                            onShowContactBlockedHint={() => setShowContactBlockedHint(true)}
                            onBlockedContactAttempt={handleBlockedContactAttempt}
                            onOpenMemberContact={() => openMemberContactPopup(memberName, member.userId)}
                            isMenuOpen={isMenuOpen}
                            onToggleMenu={() => setIsMenuOpen((currentState) => !currentState)}
                            isAdminUser={isAdminUser}
                            isViewedMemberAdmin={isViewedMemberAdmin}
                            menuActionState={menuActionState}
                            onInvite={handleInvite}
                            onDeleteMember={handleDeleteMemberPlaceholder}
                            onRemoveFromJamCircle={handleRemoveFromJamCircle}
                            onBlockMember={handleBlockMember}
                            onOpenReportPopup={openReportPopup}
                        />
                    ) : null}
                </div>
            </header>

            {isProfileRestricted ? (
                <div className="profile-section">
                    <div className="profile-restricted-card" role="status" aria-live="polite">
                        <img src={privacyNobodyIcon} alt="Restricted profile" className="profile-restricted-icon" />
                        <p className="profile-restricted-text">{memberName}&apos;s Profile has restrict view.</p>
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
                    {isOrganisationProfile ? (
                        <OrganisationProfileSection member={member} currentUser={user} apiUrl={API_URL} />
                    ) : (
                        <>
                            <div className="profile-section-heading">
                                <h2>Interests</h2>
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
                        </>
                    )}
                </div>
            ) : null}

            {!isOrganisationProfile && !isProfileRestricted ? (
                <div className="profile-section">
                    <div className="profile-section-heading">
                        <h2>Activity</h2>
                    </div>
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
                            canEditEvent={false}
                            canDeleteEvent={false}
                            goingEventIds={goingActivityEventIds}
                            emptyMessage={PLACEHOLDERS.activity}
                        />
                    ) : (
                        <p className="profile-copy">{PLACEHOLDERS.activity}</p>
                    )}
                </div>
            ) : null}

            {!isOrganisationProfile ? (
                <MemberPublicProfileDialogs
                    apiUrl={API_URL}
                    currentUser={user}
                    memberName={memberName}
                    isMemberContactPopupOpen={isMemberContactPopupOpen}
                    contactTargetName={contactTargetName}
                    contactTargetUserId={contactTargetUserId}
                    onCloseMemberContactPopup={closeMemberContactPopup}
                    invitePopup={invitePopup}
                    onCloseInvitePopup={closeInvitePopup}
                    isDeleteMemberPopupOpen={isDeleteMemberPopupOpen}
                    onCloseDeleteMemberPopup={closeDeleteMemberPopup}
                    deleteMemberConfirmation={deleteMemberConfirmation}
                    onDeleteMemberConfirmationChange={onDeleteMemberConfirmationChange}
                    deleteMemberError={deleteMemberError}
                    isDeleteMemberConfirmationValid={isDeleteMemberConfirmationValid}
                    isDeletingMemberAccount={isDeletingMemberAccount}
                    onDeleteMemberAccount={handleDeleteMemberAccount}
                    isReportPopupOpen={isReportPopupOpen}
                    onCloseReportPopup={closeReportPopup}
                    reportReasons={reportReasons}
                    onToggleReportReason={toggleReportReason}
                    reportDetails={reportDetails}
                    onReportDetailsChange={onReportDetailsChange}
                    reportError={reportError}
                    isSubmittingReport={isSubmittingReport}
                    onSubmitProfileReport={handleSubmitProfileReport}
                />
            ) : null}
        </section>
    );
}

