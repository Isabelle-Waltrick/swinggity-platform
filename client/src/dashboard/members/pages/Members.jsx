import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import instagramIcon from '../../../assets/instagram-icon.svg';
import facebookIcon from '../../../assets/facebook-icon.svg';
import youtubeIcon from '../../../assets/youtube-icon.svg';
import linkedinIcon from '../../../assets/likedin-icon.svg';
import ProfileAvatar from '../../../components/ProfileAvatar';
import { useAuth } from '../../../auth/context/useAuth';
import { Plus } from '../../calendar/components/Plus';
import './Members.css';

const SOCIAL_PLATFORMS = {
    instagram: { label: 'Instagram', icon: instagramIcon },
    facebook: { label: 'Facebook', icon: facebookIcon },
    youtube: { label: 'YouTube', icon: youtubeIcon },
    linkedin: { label: 'LinkedIn', icon: linkedinIcon },
};

const SOCIAL_KEYS = ['instagram', 'facebook', 'youtube', 'linkedin'];

const TAG_COLORS = [
    'members-tag-color-1',
    'members-tag-color-2',
    'members-tag-color-3',
    'members-tag-color-4',
    'members-tag-color-5',
];

const getName = (member) => {
    const firstName = typeof member?.displayFirstName === 'string' ? member.displayFirstName.trim() : '';
    const lastName = typeof member?.displayLastName === 'string' ? member.displayLastName.trim() : '';
    return `${firstName} ${lastName}`.trim() || 'Swinggity Member';
};

export default function MembersPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [invitingMemberId, setInvitingMemberId] = useState('');
    const [invitePopupMessage, setInvitePopupMessage] = useState('');
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const currentUserId = user?._id || '';

    useEffect(() => {
        const fetchMembers = async () => {
            setIsLoading(true);
            setError('');

            try {
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const response = await fetch(`${API_URL}/api/auth/members`, {
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

    const renderedMembers = useMemo(
        () => members.map((member) => {
            const tags = Array.isArray(member.tags)
                ? member.tags.map((tag) => (typeof tag === 'string' ? tag.trim() : '')).filter(Boolean)
                : [];

            const socialLinks = member?.socialLinks && typeof member.socialLinks === 'object'
                ? member.socialLinks
                : {};

            const visibleSocialKeys = SOCIAL_KEYS
                .filter((key) => typeof socialLinks[key] === 'string' && socialLinks[key].trim().length > 0);

            return {
                ...member,
                name: getName(member),
                bio: typeof member.bio === 'string' ? member.bio.trim() : '',
                pronouns: typeof member.pronouns === 'string' ? member.pronouns.trim() : '',
                tags,
                showSocialLinks: member?.showSocialLinks === true,
                visibleSocialKeys,
                isCurrentUser: member?.isCurrentUser === true || String(member?.userId || '') === String(currentUserId),
                isInJamCircle: member?.isInJamCircle === true,
                hasPendingInviteFromCurrentUser: member?.hasPendingInviteFromCurrentUser === true,
            };
        }),
        [members, currentUserId]
    );

    const openSocialLink = (memberId, socialKey) => {
        const memberIdPart = encodeURIComponent(String(memberId || ''));
        const platformPart = encodeURIComponent(String(socialKey || ''));
        window.open(`${API_URL}/api/auth/members/${memberIdPart}/social/${platformPart}`, '_blank', 'noopener,noreferrer');
    };

    const handleViewProfile = (member) => {
        navigate(`/dashboard/members/${encodeURIComponent(String(member?.userId || ''))}`);
    };

    const handleInvite = async (member) => {
        if (member.isCurrentUser) {
            setInvitePopupMessage("You can't add yourself.");
            return;
        }

        if (member.isInJamCircle || member.hasPendingInviteFromCurrentUser || invitingMemberId) {
            return;
        }

        setInvitingMemberId(String(member.userId || ''));
        try {
            const memberIdPart = encodeURIComponent(String(member?.userId || ''));
            const response = await fetch(`${API_URL}/api/auth/members/${memberIdPart}/invite`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to send invitation.');
            }

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

            {isLoading ? <p className="members-info">Loading members...</p> : null}
            {error ? <p className="members-error">{error}</p> : null}

            {!isLoading && !error && renderedMembers.length === 0 ? (
                <p className="members-info">No discoverable members yet.</p>
            ) : null}

            <div className="members-grid" aria-live="polite">
                {renderedMembers.map((member) => (
                    <article key={member.userId} className="member-card">
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
                            {member.pronouns ? <span className="member-pronouns"> ({member.pronouns})</span> : null}
                        </h2>

                        {member.bio ? <p className="member-bio">{member.bio}</p> : null}

                        {member.tags.length > 0 ? (
                            <div className="member-tags" aria-label="Member tags">
                                {member.tags.map((tag, index) => (
                                    <span key={`${member.userId}-${tag}-${index}`} className={`member-tag ${TAG_COLORS[index % TAG_COLORS.length]}`}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        ) : null}

                        {member.showSocialLinks ? (
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

                        <div className="member-actions">
                            <button type="button" className="member-btn member-btn-secondary" onClick={() => handleViewProfile(member)}>
                                View Profile
                            </button>
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
                        </div>
                    </article>
                ))}
            </div>

            {invitePopupMessage ? (
                <div
                    className="members-popup-overlay"
                    role="presentation"
                    onClick={() => setInvitePopupMessage('')}
                >
                    <div
                        className="members-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="members-popup-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="members-popup-title" className="members-popup-title">All Good!</h2>
                        <p className="members-popup-description">{invitePopupMessage}</p>
                        <div className="members-popup-actions">
                            <button
                                type="button"
                                className="members-popup-button"
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
