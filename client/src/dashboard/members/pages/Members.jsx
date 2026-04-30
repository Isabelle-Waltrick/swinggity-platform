// The code in this file were created with help of AI (Copilot)

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import instagramIcon from '../../../assets/instagram-icon.svg';
import facebookIcon from '../../../assets/facebook-icon.svg';
import youtubeIcon from '../../../assets/youtube-icon.svg';
import linkedinIcon from '../../../assets/likedin-icon.svg';
import websiteIcon from '../../../assets/website-icon.svg';
import ProfileAvatar from '../../../components/ProfileAvatar';
import { useAuth } from '../../../auth/context/useAuth';
import { Plus } from '../../calendar/components/Plus';
import './Members.css';

// Supported social platforms are mapped once so member cards can render links data-first.
const SOCIAL_PLATFORMS = {
    instagram: { label: 'Instagram', icon: instagramIcon },
    facebook: { label: 'Facebook', icon: facebookIcon },
    youtube: { label: 'YouTube', icon: youtubeIcon },
    linkedin: { label: 'LinkedIn', icon: linkedinIcon },
    website: { label: 'Website', icon: websiteIcon },
};

// Keep social key order stable so icons render predictably across cards.
const SOCIAL_KEYS = ['instagram', 'facebook', 'youtube', 'linkedin', 'website'];

// Tag colors rotate by index to avoid visually flat tag lists.
const TAG_COLORS = [
    'members-tag-color-1',
    'members-tag-color-2',
    'members-tag-color-3',
    'members-tag-color-4',
    'members-tag-color-5',
];

// Build one display-ready name for both people and organisations.
const getName = (member) => {
    const firstName = typeof member?.displayFirstName === 'string' ? member.displayFirstName.trim() : '';
    const lastName = typeof member?.displayLastName === 'string' ? member.displayLastName.trim() : '';
    if (member?.entityType === 'organisation') {
        return firstName || 'Swinggity Organisation';
    }
    return `${firstName} ${lastName}`.trim() || 'Swinggity Member';
};

/**
 * MembersPage:
 * Renders discoverable organisations and members, normalizes member payloads,
 * exposes profile/social actions, and supports Jam Circle invitations.
 */
// FR50: This page renders the community members overview — all discoverable members and organisations for User and Organiser roles.
export default function MembersPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Remote members state tracks the fetched directory plus loading/error states.
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Invitation state tracks in-flight invites and popup feedback messages.
    const [invitingMemberId, setInvitingMemberId] = useState('');
    const [invitePopupMessage, setInvitePopupMessage] = useState('');

    // API base url supports both local development and deployed environments.
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    // Current-user derived flags drive role-restricted actions in the directory.
    const currentUserId = user?._id || '';
    const normalizedUserRole = String(user?.role || '').trim().toLowerCase();
    const isAdminUser = normalizedUserRole === 'admin';

    // FR50: Fetches the full member directory on mount to populate the community overview page.
    // Load discoverable members once when the page mounts.
    useEffect(() => {
        const fetchMembers = async () => {
            setIsLoading(true);
            setError('');

            try {
                // Keep a local fallback here so the request still works even if outer values change later.
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const response = await fetch(`${API_URL}/api/members`, {
                    credentials: 'include',
                });
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load members.');
                }

                setMembers(Array.isArray(data.members) ? data.members : []);
            } catch (fetchError) {
                setError(fetchError.message || 'Unable to load members right now.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchMembers();
    }, []);

    // Normalize raw member payloads once, then split them into organisations and people.
    const { organisations, membersList } = useMemo(
        () => {
            const processed = members.map((member) => {
                // Tags are trimmed and filtered so empty values never reach the UI.
                const tags = Array.isArray(member.tags)
                    ? member.tags.map((tag) => (typeof tag === 'string' ? tag.trim() : '')).filter(Boolean)
                    : [];

                // Only object-shaped online links are considered safe to inspect.
                const onlineLinks = member?.onlineLinks && typeof member.onlineLinks === 'object'
                    ? member.onlineLinks
                    : {};

                // Keep only social platforms that actually have values to display.
                const visibleSocialKeys = SOCIAL_KEYS
                    .filter((key) => typeof onlineLinks[key] === 'string' && onlineLinks[key].trim().length > 0);

                // Organisation/member type is normalized so downstream rendering can stay simple.
                const entityType = member?.entityType === 'organisation' ? 'organisation' : 'member';
                const isOrganisation = entityType === 'organisation';
                // Admin accounts are a special type of member that are hidden from the public directory and have restrictions on interactions.
                return {
                    ...member,
                    entityType,
                    isOrganisation,
                    isAdminAccount: String(member?.role || '').trim().toLowerCase() === 'admin',
                    name: getName(member),
                    bio: typeof member.bio === 'string' ? member.bio.trim() : '',
                    pronouns: typeof member.pronouns === 'string' ? member.pronouns.trim() : '',
                    tags,
                    showOnlineLinks: member?.showOnlineLinks === true,
                    visibleSocialKeys,
                    isCurrentUser: member?.isCurrentUser === true || String(member?.userId || '') === String(currentUserId),
                    isInJamCircle: member?.isInJamCircle === true,
                    hasPendingInviteFromCurrentUser: member?.hasPendingInviteFromCurrentUser === true,
                };
            });

            return {
                // Organisations render in a dedicated section above members.
                organisations: processed.filter((m) => m.isOrganisation),
                // Admin accounts are intentionally excluded from the public members list.
                membersList: processed.filter((m) => !m.isOrganisation && !m.isAdminAccount),
            };
        },
        [members, currentUserId]
    );

    // Social links are opened via the backend redirect route instead of exposing raw URLs directly in the page.
    const openSocialLink = (memberId, socialKey) => {
        const memberIdPart = encodeURIComponent(String(memberId || ''));
        const platformPart = encodeURIComponent(String(socialKey || ''));
        window.open(`${API_URL}/api/members/${memberIdPart}/social/${platformPart}`, '_blank', 'noopener,noreferrer');
    };

    // Navigate to the selected member or organisation profile page.
    const handleViewProfile = (member) => {
        navigate(`/dashboard/members/${encodeURIComponent(String(member?.userId || ''))}`);
    };

    // FR51: Sends a Jam Circle invitation to the selected member via POST /api/jam-circle/members/:id/invite.
    // Send a Jam Circle invitation after checking all role and state restrictions.
    const handleInvite = async (member) => {
        // Admin accounts cannot be invite to Jam Circles.
        if (isAdminUser) {
            setInvitePopupMessage('Admin accounts cannot add members to a Jam Circle.');
            return;
        }
        // Organisations cannot be invited to Jam Circles since they are not individual users.
        if (member.isOrganisation) {
            return;
        }
        // Admin accounts also cannot be invited to Jam Circle.
        if (member.isAdminAccount) {
            setInvitePopupMessage('Admin accounts cannot be added to a Jam Circle.');
            return;
        }
        // Users cannot invite themselves to their own Jam Circle.
        if (member.isCurrentUser) {
            setInvitePopupMessage("You can't add yourself.");
            return;
        }
        // Members who are already in the Jam Circle or have pending invites should not be invite again.
        if (member.isInJamCircle || member.hasPendingInviteFromCurrentUser || invitingMemberId) {
            return;
        }
        // Set the inviting member ID to disable the invite button and show "Sending..." feedback while the request is in-flight.
        setInvitingMemberId(String(member.userId || ''));
        try {
            const memberIdPart = encodeURIComponent(String(member?.userId || ''));
            const response = await fetch(`${API_URL}/api/jam-circle/members/${memberIdPart}/invite`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to send invitation.');
            }

            // Mark the member locally so the UI reflects the pending invite immediately.
            setMembers((currentMembers) => currentMembers.map((item) => (
                String(item?.userId || '') === String(member?.userId || '')
                    ? { ...item, hasPendingInviteFromCurrentUser: true }
                    : item
            )));
            setInvitePopupMessage('Your invitation was sent. They will appear in your Jam Circle if they accept it!');
        } catch (inviteError) {
            setInvitePopupMessage(inviteError.message || 'Unable to send invitation.');
        } finally {
            setInvitingMemberId('');
        }
    };

    return (
        <section className="members-page" aria-label="Community members">
            <h1 className="members-title">Community Members</h1>

            {/* Page-level loading, error, and empty-state feedback. */}
            {isLoading ? <p className="members-info">Loading members...</p> : null}
            {error ? <p className="members-error">{error}</p> : null}

            {!isLoading && !error && organisations.length === 0 && membersList.length === 0 ? (
                <p className="members-info">No discoverable members yet.</p>
            ) : null}

            {/* Organisations are grouped separately from member profiles. */}
            {!isLoading && organisations.length > 0 ? (
                <section className="members-section" aria-labelledby="organisations-heading">
                    <h2 id="organisations-heading" className="members-section-heading">Organisations</h2>
                    <div className="members-grid" aria-live="polite">
                        {organisations.map((member) => (
                            <article key={member.userId} className="member-card">
                                {/* Avatar is decorative here because the card already contains the member name. */}
                                <div className="member-avatar" aria-hidden="true">
                                    <ProfileAvatar
                                        firstName={member.displayFirstName}
                                        lastName={member.displayLastName}
                                        avatarUrl={member.avatarUrl}
                                        size={122}
                                    />
                                </div>

                                {/* Organisations use the same heading structure as people for layout consistency. */}
                                <h2 className="member-name">
                                    {member.name}
                                    {!member.isOrganisation && member.pronouns ? <span className="member-pronouns"> ({member.pronouns})</span> : null}
                                </h2>

                                {member.bio ? <p className="member-bio">{member.bio}</p> : null}

                                {/* Social buttons are shown only for links the member chose to expose. */}
                                {member.showOnlineLinks ? (
                                    <div className="member-social-links">
                                        {member.visibleSocialKeys.map((socialKey) => {
                                            const platform = SOCIAL_PLATFORMS[socialKey];
                                            if (!platform) return null;

                                            return (
                                                <button
                                                    key={`${member.userId}-${socialKey}`}
                                                    className="member-social-link"
                                                    type="button"
                                                    aria-label={platform.label}
                                                    onClick={() => openSocialLink(member.userId, socialKey)}
                                                >
                                                    <img src={platform.icon} alt="" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : null}

                                {/* Organisations can be viewed, while invite actions stay limited to people. */}
                                <div className="member-actions">
                                    <button type="button" className="member-btn member-btn-secondary" onClick={() => handleViewProfile(member)}>
                                        {member.isOrganisation ? 'View Organisation' : 'View Profile'}
                                    </button>
                                    {!member.isOrganisation && !isAdminUser && !member.isAdminAccount ? (
                                        <button
                                            type="button"
                                            className="member-btn member-btn-primary"
                                            onClick={() => handleInvite(member)}
                                            disabled={
                                                member.isCurrentUser
                                                || member.isInJamCircle
                                                || member.hasPendingInviteFromCurrentUser
                                                || invitingMemberId === String(member?.userId || '')
                                            }
                                        >
                                            {member.isCurrentUser
                                                ? "That's You"
                                                : member.isInJamCircle
                                                    ? 'In Your Jam Circle'
                                                    : member.hasPendingInviteFromCurrentUser
                                                        ? 'Invitation Sent'
                                                        : invitingMemberId === String(member?.userId || '')
                                                            ? 'Sending...'
                                                            : 'Invite to Jam Circle'}
                                            <Plus className="member-btn-plus" />
                                        </button>
                                    ) : null}
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}

            {/* People render in a separate members section below organisations. */}
            {!isLoading && membersList.length > 0 ? (
                <section className="members-section" aria-labelledby="members-heading">
                    <h2 id="members-heading" className="members-section-heading">Members</h2>
                    <div className="members-grid" aria-live="polite">
                        {membersList.map((member) => (
                            <article key={member.userId} className="member-card">
                                {/* Avatar is decorative here because the card already contains the member name. */}
                                <div className="member-avatar" aria-hidden="true">
                                    <ProfileAvatar
                                        firstName={member.displayFirstName}
                                        lastName={member.displayLastName}
                                        avatarUrl={member.avatarUrl}
                                        size={122}
                                    />
                                </div>

                                <h2 className="member-name">
                                    {member.name}
                                    {!member.isOrganisation && member.pronouns ? <span className="member-pronouns"> ({member.pronouns})</span> : null}
                                </h2>

                                {member.bio ? <p className="member-bio">{member.bio}</p> : null}

                                {/* Tags highlight interests or identifiers chosen by the member. */}
                                {member.tags.length > 0 ? (
                                    <div className="member-tags" aria-label="Member tags">
                                        {member.tags.map((tag, index) => (
                                            <span key={`${member.userId}-${tag}-${index}`} className={`member-tag ${TAG_COLORS[index % TAG_COLORS.length]}`}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}

                                {/* Social buttons are shown only for links the member chose to expose. */}
                                {member.showOnlineLinks ? (
                                    <div className="member-social-links">
                                        {member.visibleSocialKeys.map((socialKey) => {
                                            const platform = SOCIAL_PLATFORMS[socialKey];
                                            if (!platform) return null;

                                            return (
                                                <button
                                                    key={`${member.userId}-${socialKey}`}
                                                    className="member-social-link"
                                                    type="button"
                                                    aria-label={platform.label}
                                                    onClick={() => openSocialLink(member.userId, socialKey)}
                                                >
                                                    <img src={platform.icon} alt="" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : null}

                                {/* Action row lets users view profiles and invite eligible members to their Jam Circle. */}
                                <div className="member-actions">
                                    <button type="button" className="member-btn member-btn-secondary" onClick={() => handleViewProfile(member)}>
                                        {member.isOrganisation ? 'View Organisation' : 'View Profile'}
                                    </button>
                                    {!member.isOrganisation && !isAdminUser && !member.isAdminAccount ? (
                                        <button
                                            type="button"
                                            className="member-btn member-btn-primary"
                                            onClick={() => handleInvite(member)}
                                            disabled={
                                                member.isCurrentUser
                                                || member.isInJamCircle
                                                || member.hasPendingInviteFromCurrentUser
                                                || invitingMemberId === String(member?.userId || '')
                                            }
                                        >
                                            {member.isCurrentUser
                                                ? "That's You"
                                                : member.isInJamCircle
                                                    ? 'In Your Jam Circle'
                                                    : member.hasPendingInviteFromCurrentUser
                                                        ? 'Invitation Sent'
                                                        : invitingMemberId === String(member?.userId || '')
                                                            ? 'Sending...'
                                                            : 'Invite to Jam Circle'}
                                            <Plus className="member-btn-plus" />
                                        </button>
                                    ) : null}
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}

            {/* Popup confirms invite outcomes and validation messages in one reusable surface. */}
            {invitePopupMessage ? (
                <div
                    className="notification-response-popup-overlay"
                    role="presentation"
                    onClick={() => setInvitePopupMessage('')}
                >
                    <div
                        className="notification-response-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="members-popup-title"
                        aria-describedby="members-popup-description"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="members-popup-title" className="notification-response-popup-title">All Set</h2>
                        <p id="members-popup-description" className="notification-response-popup-description">{invitePopupMessage}</p>
                        <div className="notification-response-popup-actions">
                            <button
                                type="button"
                                className="notification-response-popup-button"
                                onClick={() => setInvitePopupMessage('')}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}

