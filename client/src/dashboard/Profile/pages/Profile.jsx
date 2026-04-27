import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import instagramIcon from '../../../assets/instagram-icon.svg';
import facebookIcon from '../../../assets/facebook-icon.svg';
import youtubeIcon from '../../../assets/youtube-icon.svg';
import linkedinIcon from '../../../assets/likedin-icon.svg';
import websiteIcon from '../../../assets/website-icon.svg';
import { isEventActivityType, uniqueActivityFeed } from '../../utils/activityFeed';
import DeleteActivityEventModal from '../components/DeleteActivityEventModal';
import ProfileActivitySection from '../components/ProfileActivitySection';
import ProfileHeader from '../components/ProfileHeader';
import ProfileInterestsSection from '../components/ProfileInterestsSection';
import ProfileJamCircleSection from '../components/ProfileJamCircleSection';
import { getDisplayName, getInitials, normalizeSocialUrl, normalizeTagList } from '../utils/profileDisplay';
import '../../calendar/styles/Calendar.css';
import './Profile.css';

// Shared empty-state copy keeps section fallbacks consistent across the page.
const PLACEHOLDERS = {
    bio: 'No bio to show. Let other members know a hit more about your lovely self.',
    interests: 'No tags to show. Adding interests helps you to connect with other members.',
    activity: 'You haven\'t interacted in the platform yet. Your activities in the platform will be shown here.',
};

// Tag colors rotate by index so repeated tags still get a varied visual treatment.
const TAG_COLORS = [
    'profile-tag-color-1',
    'profile-tag-color-2',
    'profile-tag-color-3',
    'profile-tag-color-4',
    'profile-tag-color-5',
];

// Supported social platforms are mapped once so rendering stays data-driven.
const SOCIAL_PLATFORMS = [
    { key: 'instagram', label: 'Instagram', icon: instagramIcon },
    { key: 'facebook', label: 'Facebook', icon: facebookIcon },
    { key: 'youtube', label: 'YouTube', icon: youtubeIcon },
    { key: 'linkedin', label: 'LinkedIn', icon: linkedinIcon },
    { key: 'website', label: 'Website', icon: websiteIcon },
];

/**
 * ProfilePage:
 * Renders the logged-in user's profile, their jam-circle preview, interests,
 * and profile activity with event actions.
 */
export default function ProfilePage({ showEditControls = true }) {
    const { user, setAuthenticatedUser } = useAuth();
    const navigate = useNavigate();
    // Jam-circle state is kept locally because the page can re-fetch and expand/collapse it.
    const [jamCircleMembers, setJamCircleMembers] = useState(Array.isArray(user?.jamCircleMembers) ? user.jamCircleMembers : []);
    const [isJamCircleExpanded, setIsJamCircleExpanded] = useState(false);
    const [isCircleLoading, setIsCircleLoading] = useState(true);
    // Activity event state tracks fetched event payloads and in-flight actions.
    const [activityEventsById, setActivityEventsById] = useState({});
    const [goingActivityEventIds, setGoingActivityEventIds] = useState([]);
    const [deletingActivityEventId, setDeletingActivityEventId] = useState('');
    const [pendingDeleteActivityEventId, setPendingDeleteActivityEventId] = useState('');
    const [isDeleteActivityPopupOpen, setIsDeleteActivityPopupOpen] = useState(false);
    const [activityDeleteError, setActivityDeleteError] = useState('');

    // API base url supports both local development and deployed environments.
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    // Role-derived flags drive which profile sections and actions the page exposes.
    const normalizedUserRole = String(user?.role || '').trim().toLowerCase();
    const isAdminUser = normalizedUserRole === 'admin';
    const canMarkGoing = normalizedUserRole !== 'admin';

    // Prefer profile display names, then fall back to account names.
    const resolvedDisplayFirstName = user?.displayFirstName?.trim() || user?.firstName || '';
    const resolvedDisplayLastName = user?.displayLastName?.trim() || user?.lastName || '';

    // Build one display-ready full name for the main profile header.
    const userName = useMemo(() => {
        return getDisplayName(resolvedDisplayFirstName, resolvedDisplayLastName, 'New Member');
    }, [resolvedDisplayFirstName, resolvedDisplayLastName]);
    // Admins do not display pronouns on this page variant.
    const displayPronouns = isAdminUser ? '' : (typeof user?.pronouns === 'string' ? user.pronouns.trim() : '');

    // Generate initials fallback when no avatar image exists.
    const initials = useMemo(() => {
        return getInitials(resolvedDisplayFirstName, resolvedDisplayLastName, 'NM');
    }, [resolvedDisplayFirstName, resolvedDisplayLastName]);

    // Keep profile text values grouped so render helpers can use one lookup object.
    const profileData = {
        bio: user?.bio ?? '',
    };

    // Normalize activity messages and remove duplicates before rendering the activity feed.
    const activityFeed = useMemo(() => uniqueActivityFeed(
        (Array.isArray(user?.activityFeed) ? user.activityFeed : [])
            .map((item) => ({
                ...item,
                message: typeof item?.message === 'string' ? item.message.trim() : '',
            }))
    ), [user?.activityFeed]);

    // Collect only event ids referenced by supported event-related activity items.
    const activityEventIds = useMemo(() => ([...new Set(
        activityFeed
            .filter((item) => isEventActivityType(item?.type) && item?.entityType === 'event' && item?.type !== 'event.deleted')
            .map((item) => String(item?.entityId || '').trim())
            .filter(Boolean)
    )]), [activityFeed]);

    // Joined key gives the effect a simple primitive dependency that changes with content order.
    const activityEventIdsKey = activityEventIds.join('|');

    // Derived list helpers keep the jam-circle render branch simple.
    const hasHiddenJamCircleMembers = jamCircleMembers.length > 3;
    const visibleJamCircleMembers = isJamCircleExpanded ? jamCircleMembers : jamCircleMembers.slice(0, 3);

    // Admins skip jam-circle loading because that section is hidden for them.
    useEffect(() => {
        if (isAdminUser) {
            setJamCircleMembers([]);
            setIsCircleLoading(false);
            return;
        }

        // Refresh the jam-circle list from the dedicated endpoint so the profile shows current data.
        const fetchJamCircle = async () => {
            setIsCircleLoading(true);
            try {
                const response = await fetch(`${API_URL}/api/jam-circle/profile/jam-circle`, {
                    credentials: 'include',
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load your Jam Circle.');
                }

                setJamCircleMembers(Array.isArray(data.members) ? data.members : []);
            } catch {
                // Fall back to auth payload data if the fetch fails.
                setJamCircleMembers(Array.isArray(user?.jamCircleMembers) ? user.jamCircleMembers : []);
            } finally {
                setIsCircleLoading(false);
            }
        };

        fetchJamCircle();
    }, [API_URL, isAdminUser, user?.jamCircleMembers]);

    // Collapse the expanded list automatically when there are too few members to truncate.
    useEffect(() => {
        if (jamCircleMembers.length <= 3) {
            setIsJamCircleExpanded(false);
        }
    }, [jamCircleMembers.length]);

    // Resolve activity event ids into full event payloads used by the shared activity-feed component.
    useEffect(() => {
        let isCancelled = false;

        const fetchActivityEvents = async () => {
            // Clear stale event data when the feed no longer references any events.
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

                // Keep only events referenced by this user's activity feed.
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
                    // Fall back to an empty event lookup if the activity-event fetch fails.
                    setActivityEventsById({});
                }
            }
        };

        fetchActivityEvents();

        return () => {
            isCancelled = true;
        };
    }, [API_URL, activityEventIds, activityEventIdsKey]);

    // Trim and discard empty tags before rendering the interests cloud.
    const profileTags = normalizeTagList(user?.profileTags);

    // Keep only social links that normalize into valid external URLs.
    const onlineLinks = SOCIAL_PLATFORMS
        .map((platform) => ({
            ...platform,
            href: normalizeSocialUrl(user?.[platform.key]),
        }))
        .filter((platform) => Boolean(platform.href));

    // All edit controls navigate to the dedicated profile edit page.
    const goToEditPage = () => {
        navigate('/dashboard/profile/edit');
    };

    // Support both absolute avatar URLs and backend-hosted relative upload paths.
    const avatarSrc = user?.avatarUrl
        ? (user.avatarUrl.startsWith('http') ? user.avatarUrl : `${API_URL}${user.avatarUrl}`)
        : '';

    // Open the selected activity event in the calendar detail view.
    const handleViewActivityEvent = (eventId) => {
        const normalizedEventId = String(eventId || '').trim();
        if (!normalizedEventId) return;
        navigate(`/dashboard/calendar/${encodeURIComponent(normalizedEventId)}`);
    };

    // Open the calendar edit screen for an event referenced in the activity feed.
    const handleEditActivityEvent = (eventId) => {
        const normalizedEventId = String(eventId || '').trim();
        if (!normalizedEventId) return;
        navigate(`/dashboard/calendar/edit/${encodeURIComponent(normalizedEventId)}`);
    };

    // Open the delete confirmation popup for the selected activity event.
    const requestDeleteActivityEvent = (eventId) => {
        const normalizedEventId = String(eventId || '').trim();
        if (!normalizedEventId || deletingActivityEventId) return;
        setPendingDeleteActivityEventId(normalizedEventId);
        setIsDeleteActivityPopupOpen(true);
        setActivityDeleteError('');
    };

    // Close the delete popup unless a delete request is already in flight.
    const closeDeleteActivityPopup = () => {
        if (deletingActivityEventId) return;
        setIsDeleteActivityPopupOpen(false);
        setPendingDeleteActivityEventId('');
    };

    // Commit the confirmed delete action and then clear the pending id.
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

    // Delete an activity-linked event and remove it from both local event state and auth activity state.
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

            // Remove the deleted event from the event lookup used by the activity feed.
            setActivityEventsById((current) => {
                const next = { ...current };
                delete next[normalizedEventId];
                return next;
            });

            // Also remove matching activity items from the authenticated user snapshot.
            setAuthenticatedUser((previous) => {
                if (!previous) return previous;

                const currentFeed = Array.isArray(previous.activityFeed) ? previous.activityFeed : [];
                const nextFeed = currentFeed.filter((item) => String(item?.entityId || '') !== normalizedEventId);

                return {
                    ...previous,
                    // Keep the structured activityFeed array in sync.
                    activityFeed: nextFeed,
                    // Rebuild the legacy string activity field expected elsewhere in the app.
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

    // Mark attendance for an event referenced in the activity feed and refresh its event payload.
    const handleMarkActivityEventGoing = async (eventId) => {
        const normalizedEventId = String(eventId || '').trim();
        if (!canMarkGoing || !normalizedEventId || goingActivityEventIds.includes(normalizedEventId)) return;

        // Track in-flight attendance updates so the same event cannot be submitted twice.
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

            // Replace just the updated event payload in the local event lookup.
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

    return (
        <section className="profile-page" aria-label="My profile">
            {/* Header shows avatar, name, bio, and social links. */}
            <ProfileHeader
                avatarSrc={avatarSrc}
                bio={profileData.bio || PLACEHOLDERS.bio}
                displayPronouns={displayPronouns}
                initials={initials}
                onlineLinks={onlineLinks}
                onEdit={goToEditPage}
                showEditControls={showEditControls}
                userName={userName}
            />

            {/* Jam Circle is hidden entirely for admin users. */}
            {!isAdminUser ? (
                <ProfileJamCircleSection
                    hasHiddenMembers={hasHiddenJamCircleMembers}
                    isExpanded={isJamCircleExpanded}
                    isLoading={isCircleLoading}
                    members={visibleJamCircleMembers}
                    onMemberClick={(memberId) => navigate(`/dashboard/members/${memberId}`)}
                    onToggleExpanded={() => setIsJamCircleExpanded((current) => !current)}
                />
            ) : null}

            {/* Interests are also hidden for admin users on this page. */}
            {!isAdminUser ? (
                <ProfileInterestsSection
                    placeholder={PLACEHOLDERS.interests}
                    showEditControls={showEditControls}
                    tags={profileTags}
                    tagColors={TAG_COLORS}
                    onEdit={goToEditPage}
                />
            ) : null}

            {/* Activity section is shared by all users and wires through event actions. */}
            <ProfileActivitySection
                activityDeleteError={activityDeleteError}
                activityEventsById={activityEventsById}
                activityFeed={activityFeed}
                apiUrl={API_URL}
                canMarkGoing={canMarkGoing}
                currentUserId={user?._id}
                currentUserRole={user?.role}
                emptyMessage={PLACEHOLDERS.activity}
                goingEventIds={goingActivityEventIds}
                isDeletingEventId={deletingActivityEventId}
                onDeleteEvent={requestDeleteActivityEvent}
                onEdit={goToEditPage}
                onEditEvent={handleEditActivityEvent}
                onMarkGoing={handleMarkActivityEventGoing}
                onOrganizerClick={(organizerId) => navigate(`/dashboard/members/${encodeURIComponent(organizerId)}`)}
                onViewEvent={handleViewActivityEvent}
                showEditControls={showEditControls}
            />

            {/* Confirmation modal prevents accidental event deletion from the activity feed. */}
            {isDeleteActivityPopupOpen ? (
                <DeleteActivityEventModal
                    isDeleting={Boolean(deletingActivityEventId)}
                    onCancel={closeDeleteActivityPopup}
                    onConfirm={confirmDeleteActivityEvent}
                />
            ) : null}
        </section>
    );
}
