import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import AttendeesPopup from '../../../components/AttendeesPopup';
import MemberContactPopup from '../../../components/MemberContactPopup';
import ProfileAvatar from '../../../components/ProfileAvatar';
import { CheckCircle } from '../components/CheckCircle';
import { MessageSquare } from '../components/MessageSquare';
import { RecycleBin } from '../components/RecycleBin';
import bellIcon from '../../../assets/bell-icon.png';
import calendarIcon from '../../../assets/calender-icon.png';
import editSquaredIcon from '../../../assets/edit-squared.svg';
import defaultEventBackground from '../../../assets/event-background-default.png';
import facebookIcon from '../../../assets/facebook-icon.svg';
import instagramIcon from '../../../assets/instagram-icon.svg';
import linkedinIcon from '../../../assets/likedin-icon.svg';
import locationIcon from '../../../assets/location-icon.png';
import privacyCloseCircleIcon from '../../../assets/privacy-close-circle.svg';
import privacyEveryoneIcon from '../../../assets/privacy-everyone.svg';
import privacyOpenCircleIcon from '../../../assets/privacy-open-circle.svg';
import ticketIcon from '../../../assets/ticket-icon.png';
import websiteIcon from '../../../assets/website-icon.svg';
import youtubeIcon from '../../../assets/youtube-icon.svg';
import '../styles/Calendar.css';
import '../styles/CalendarViewEvent.css';

const FALLBACK_EVENT_IMAGE = defaultEventBackground;

const SAFE_HTTP_URL_REGEX = /^https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+$/i;
const SAFE_RELATIVE_URL_REGEX = /^\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+$/;

const sanitizeAbsoluteHttpUrl = (value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!SAFE_HTTP_URL_REGEX.test(normalized)) return '';

    try {
        const parsed = new URL(normalized);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
    } catch {
        return '';
    }
};

const sanitizeResolvedAssetUrl = (apiUrl, rawUrl, fallback = '') => {
    const normalized = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!normalized) return fallback;

    if (normalized.startsWith('http')) {
        return sanitizeAbsoluteHttpUrl(normalized) || fallback;
    }

    if (SAFE_RELATIVE_URL_REGEX.test(normalized)) {
        return `${apiUrl}${normalized}`;
    }

    return fallback;
};

const formatDateTimeRange = (event) => {
    const startDate = String(event?.startDate || '').trim();
    const startTime = String(event?.startTime || '').trim();
    const endTime = String(event?.endTime || '').trim();

    if (!startDate) return 'Date not specified';

    const startDateTime = new Date(`${startDate}T${startTime || '00:00'}`);
    if (Number.isNaN(startDateTime.getTime())) return startDate;

    const datePart = startDateTime.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });

    if (!startTime) return datePart;
    if (!endTime) return `${datePart} · ${startTime}`;

    return `${datePart} · ${startTime} to ${endTime}`;
};

const getCurrencyDisplay = (currency, amount) => {
    if (!Number.isFinite(amount)) return '';

    try {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: String(currency || 'GBP').toUpperCase(),
            maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        }).format(amount);
    } catch {
        const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
        return `${String(currency || 'GBP').toUpperCase()} ${rounded}`;
    }
};

const formatTicketText = (event) => {
    if (event?.freeEvent) return 'Free';

    const minPrice = Number(event?.minPrice);
    const maxPrice = Number(event?.maxPrice);

    if (!Number.isFinite(minPrice) && !Number.isFinite(maxPrice)) return 'Price not specified';
    if (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && minPrice !== maxPrice) {
        return `${getCurrencyDisplay(event?.currency, minPrice)} - ${getCurrencyDisplay(event?.currency, maxPrice)}`;
    }

    const price = Number.isFinite(maxPrice) ? maxPrice : minPrice;
    return getCurrencyDisplay(event?.currency, price);
};

const splitNameParts = (name) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || 'Swinggity';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : 'Member';
    return { firstName, lastName };
};

const socialIconByKey = {
    instagram: instagramIcon,
    facebook: facebookIcon,
    youtube: youtubeIcon,
    linkedin: linkedinIcon,
    website: websiteIcon,
};

const socialLabelByKey = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    youtube: 'YouTube',
    linkedin: 'LinkedIn',
    website: 'Website',
};

const RESALE_VISIBILITY_OPTIONS = [
    { value: 'anyone', label: 'Anyone on Swinggity', icon: privacyEveryoneIcon },
    { value: 'mutual', label: 'My Jam Circle and mutual connections', icon: privacyOpenCircleIcon },
    { value: 'circle', label: 'My Jam Circle only', icon: privacyCloseCircleIcon },
];

const getResaleVisibilityOption = (value) => {
    const match = RESALE_VISIBILITY_OPTIONS.find((option) => option.value === value);
    return match || RESALE_VISIBILITY_OPTIONS[0];
};

const RESOLD_STATUS_OPTIONS = [
    { value: 'not-sold-out', label: 'No, we still have tickets to sell' },
    { value: 'sold-out', label: 'Yes, our tickets are sold out' },
];

const getResellStatusOption = (value) => {
    const match = RESOLD_STATUS_OPTIONS.find((option) => option.value === value);
    return match || RESOLD_STATUS_OPTIONS[0];
};

const SocialLinkIcon = ({ type }) => {
    const src = socialIconByKey[type];
    if (!src) return null;

    return <img src={src} alt="" />;
};

export default function CalendarViewEventPage() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const normalizedUserRole = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : '';
    const isAdminUser = normalizedUserRole === 'admin';
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const [event, setEvent] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isGoingPending, setIsGoingPending] = useState(false);
    const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
    const [isMemberContactPopupOpen, setIsMemberContactPopupOpen] = useState(false);
    const [contactTargetName, setContactTargetName] = useState('');
    const [contactTargetUserId, setContactTargetUserId] = useState('');
    const [isResellPopupOpen, setIsResellPopupOpen] = useState(false);
    const [isDeleteResellPopupOpen, setIsDeleteResellPopupOpen] = useState(false);
    const [resellTicketCount, setResellTicketCount] = useState('1');
    const [isResellCountOpen, setIsResellCountOpen] = useState(false);
    const [resellVisibilityDraft, setResellVisibilityDraft] = useState('anyone');
    const [isResellVisibilityOpen, setIsResellVisibilityOpen] = useState(false);
    const [isResellSubmitPending, setIsResellSubmitPending] = useState(false);
    const [isResellDeletePending, setIsResellDeletePending] = useState(false);
    const [isResellAvailabilityPending, setIsResellAvailabilityPending] = useState(false);
    const [isResellStatusOpen, setIsResellStatusOpen] = useState(false);
    const [isDeletingEvent, setIsDeletingEvent] = useState(false);
    const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
    const [isSubscribePopupOpen, setIsSubscribePopupOpen] = useState(false);
    const [resellStatusDraft, setResellStatusDraft] = useState('not-sold-out');
    const [isAttendeesPopupOpen, setIsAttendeesPopupOpen] = useState(false);
    const resellStatusDropdownRef = useRef(null);
    useEffect(() => {
        let isCancelled = false;

        const loadEvent = async () => {
            setIsLoading(true);
            setError('');

            try {
                const response = await fetch(`${API_URL}/api/calendar/events/${encodeURIComponent(String(eventId || ''))}`, {
                    credentials: 'include',
                });
                const data = await response.json();

                if (!response.ok || !data.success || !data.event) {
                    throw new Error(data.message || 'Unable to load event details.');
                }

                if (!isCancelled) {
                    setEvent(data.event);
                }
            } catch (loadError) {
                if (!isCancelled) {
                    setError(loadError.message || 'Unable to load event details.');
                    setEvent(null);
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        if (eventId) {
            loadEvent();
        } else {
            setError('Invalid event id.');
            setIsLoading(false);
        }

        return () => {
            isCancelled = true;
        };
    }, [API_URL, eventId]);

    useEffect(() => {
        if (!event) return;
        setResellStatusDraft(event?.resellActivated ? 'sold-out' : 'not-sold-out');

        const currentUserId = String(user?._id || '').trim();
        const currentUserReseller = (Array.isArray(event?.resellers) ? event.resellers : [])
            .find((reseller) => String(reseller?.userId || '').trim() === currentUserId);

        if (!currentUserReseller) {
            setResellTicketCount('1');
            setResellVisibilityDraft('anyone');
            return;
        }

        const nextTicketCount = Number(currentUserReseller?.resaleTicketCount);
        setResellTicketCount(Number.isFinite(nextTicketCount) && nextTicketCount > 0 ? String(nextTicketCount) : '1');
        setResellVisibilityDraft(getResaleVisibilityOption(String(currentUserReseller?.resaleVisibility || 'anyone')).value);
    }, [event, user?._id]);

    useEffect(() => {
        const handleDocumentClick = (mouseEvent) => {
            if (!resellStatusDropdownRef.current?.contains(mouseEvent.target)) {
                setIsResellStatusOpen(false);
            }
        };

        const handleEscape = (keyboardEvent) => {
            if (keyboardEvent.key === 'Escape') {
                setIsResellStatusOpen(false);
            }
        };

        document.addEventListener('mousedown', handleDocumentClick);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleDocumentClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const handleToggleGoing = async () => {
        if (!event || isGoingPending || isOwnEvent || isAdminUser) return;

        setIsGoingPending(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/api/calendar/events/${encodeURIComponent(event.id)}/going`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success || !data.event) {
                throw new Error(data.message || 'Unable to update attendance.');
            }

            setEvent(data.event);
        } catch (submitError) {
            setError(submitError.message || 'Unable to update attendance.');
        } finally {
            setIsGoingPending(false);
        }
    };

    const eventImage = sanitizeResolvedAssetUrl(API_URL, event?.imageUrl || '', FALLBACK_EVENT_IMAGE);
    const organizerName = String(event?.organizerName || 'Swinggity Host').trim();
    const organizerAvatarUrl = sanitizeResolvedAssetUrl(API_URL, event?.organizerAvatarUrl || '');
    const organizerUserId = String(event?.createdById || '').trim();
    const organizerUserName = String(event?.createdByName || organizerName || 'Swinggity Host').trim();
    const organizerUserAvatarUrl = sanitizeResolvedAssetUrl(API_URL, event?.createdByAvatarUrl || '');
    const publisherOrganisationId = String(event?.publisherOrganisationId || '').trim();
    const isOrganisationPublisher = event?.publisherType === 'organisation' && publisherOrganisationId.length > 0;
    const hostedByName = isOrganisationPublisher ? organizerName : organizerUserName;
    const hostedByAvatarUrl = isOrganisationPublisher ? organizerAvatarUrl : organizerUserAvatarUrl;
    const hostedByProfileId = isOrganisationPublisher ? publisherOrganisationId : organizerUserId;
    const isOwnEvent = String(user?._id || '').trim() === organizerUserId;
    const canDeleteEvent = isOwnEvent || isAdminUser;
    const organizerNameParts = splitNameParts(hostedByName);
    const attendees = Array.isArray(event?.attendees) ? event.attendees : [];
    const attendeeCount = Number.isFinite(event?.attendeesCount) ? event.attendeesCount : attendees.length;

    const attendeeUserIdByDisplayName = attendees.reduce((accumulator, attendee) => {
        const displayName = String(attendee?.displayName || '').trim().toLowerCase();
        const userId = String(attendee?.userId || '').trim();
        if (!displayName || !userId || accumulator[displayName]) return accumulator;
        accumulator[displayName] = userId;
        return accumulator;
    }, {});

    const navigateToProfile = (profileId) => {
        const normalizedProfileId = String(profileId || '').trim();
        if (!normalizedProfileId) return;
        navigate(`/dashboard/members/${encodeURIComponent(normalizedProfileId)}`);
    };

    const openMemberContactPopup = (name, userId) => {
        setContactTargetName(String(name || '').trim() || 'this user');
        setContactTargetUserId(String(userId || '').trim());
        setIsMemberContactPopupOpen(true);
    };

    const closeMemberContactPopup = () => {
        setIsMemberContactPopupOpen(false);
        setContactTargetName('');
        setContactTargetUserId('');
    };

    const closeResellPopup = () => {
        if (isResellSubmitPending) return;
        setIsResellPopupOpen(false);
        setResellTicketCount('1');
        setIsResellCountOpen(false);
        setIsResellVisibilityOpen(false);
    };

    const closeDeleteResellPopup = () => {
        if (isResellDeletePending) return;
        setIsDeleteResellPopupOpen(false);
    };

    const attendeeAvatars = attendees
        .map((attendee) => sanitizeResolvedAssetUrl(API_URL, attendee?.avatarUrl || ''))
        .filter(Boolean)
        .slice(0, 3);

    const attendeeProfiles = attendees
        .map((attendee) => ({
            userId: String(attendee?.userId || '').trim(),
            displayName: String(attendee?.displayName || '').trim() || 'Swinggity Member',
            avatarUrl: sanitizeResolvedAssetUrl(API_URL, attendee?.avatarUrl || ''),
        }))
        .filter((attendee) => attendee.userId || attendee.displayName);

    const resellerCards = (Array.isArray(event?.resellers) ? event.resellers : attendees.filter((attendee) => Number(attendee?.resaleTicketCount) > 0))
        .map((reseller, index) => ({
            id: `${reseller.userId}-${index}-${reseller.resaleTicketCount}`,
            userId: String(reseller?.userId || '').trim(),
            avatar: sanitizeResolvedAssetUrl(API_URL, reseller?.avatarUrl || ''),
            name: String(reseller?.displayName || '').trim() || 'Swinggity Member',
            resaleTicketCount: Number(reseller?.resaleTicketCount) || 0,
            isCurrentUser: String(reseller?.userId || '').trim() === String(user?._id || '').trim(),
        }));
    const currentUserResellerCard = resellerCards.find((reseller) => reseller.isCurrentUser) || null;

    const canUsersResell = Boolean(
        event?.canUsersResell
        ?? (event?.allowResell === 'yes' && (event?.resellCondition === 'Always' || event?.resellActivated))
    );

    const shouldShowResellSection = event?.allowResell === 'yes' && (canUsersResell || isOwnEvent);

    const openAttendeesPopup = () => {
        setIsAttendeesPopupOpen(true);
    };

    const closeAttendeesPopup = () => {
        setIsAttendeesPopupOpen(false);
    };

    const handleUpdateResellAvailability = async () => {
        if (!event?.id || !isOwnEvent || isResellAvailabilityPending) return;

        setIsResellAvailabilityPending(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/api/calendar/events/${encodeURIComponent(event.id)}/resell-availability`, {
                method: 'PATCH',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ soldOutStatus: resellStatusDraft }),
            });
            const data = await response.json();

            if (!response.ok || !data.success || !data.event) {
                throw new Error(data.message || 'Unable to update re-sell availability.');
            }

            setEvent(data.event);
        } catch (submitError) {
            setError(submitError.message || 'Unable to update re-sell availability.');
        } finally {
            setIsResellAvailabilityPending(false);
        }
    };

    const handleSubmitResellTickets = async () => {
        if (!event?.id || isResellSubmitPending) return;

        setIsResellSubmitPending(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/api/calendar/events/${encodeURIComponent(event.id)}/resell-tickets`, {
                method: 'PATCH',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ticketCount: Number(resellTicketCount),
                    resaleVisibility: resellVisibilityDraft,
                }),
            });
            const data = await response.json();

            if (!response.ok || !data.success || !data.event) {
                throw new Error(data.message || 'Unable to publish your re-sell tickets.');
            }

            setEvent(data.event);
            setIsResellPopupOpen(false);
            setResellTicketCount('1');
            setIsResellVisibilityOpen(false);
        } catch (submitError) {
            setError(submitError.message || 'Unable to publish your re-sell tickets.');
        } finally {
            setIsResellSubmitPending(false);
        }
    };

    const handleDeleteResellTickets = async () => {
        if (!event?.id || isResellDeletePending) return;

        setIsResellDeletePending(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/api/calendar/events/${encodeURIComponent(event.id)}/resell-tickets`, {
                method: 'PATCH',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ticketCount: 0 }),
            });
            const data = await response.json();

            if (!response.ok || !data.success || !data.event) {
                throw new Error(data.message || 'Unable to delete your re-sell ticket.');
            }

            setEvent(data.event);
            setIsDeleteResellPopupOpen(false);
        } catch (submitError) {
            setError(submitError.message || 'Unable to delete your re-sell ticket.');
        } finally {
            setIsResellDeletePending(false);
        }
    };

    const handleEditEvent = () => {
        if (!event?.id || !isOwnEvent) return;
        navigate(`/dashboard/calendar/edit/${encodeURIComponent(event.id)}`);
    };

    const requestDeleteEvent = () => {
        if (!event?.id || !canDeleteEvent || isDeletingEvent) return;
        setIsDeletePopupOpen(true);
    };

    const closeDeletePopup = () => {
        if (isDeletingEvent) return;
        setIsDeletePopupOpen(false);
    };

    const openSubscribePopup = () => {
        setIsSubscribePopupOpen(true);
    };

    const closeSubscribePopup = () => {
        setIsSubscribePopupOpen(false);
    };

    const confirmDeleteEvent = async () => {
        if (!event?.id || !canDeleteEvent || isDeletingEvent) return;

        setIsDeletingEvent(true);
        setIsDeletePopupOpen(false);
        setError('');

        try {
            const response = await fetch(`${API_URL}/api/calendar/events/${encodeURIComponent(event.id)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to delete event.');
            }

            navigate('/dashboard/calendar');
        } catch (deleteError) {
            setError(deleteError.message || 'Unable to delete event.');
        } finally {
            setIsDeletingEvent(false);
        }
    };

    const eventLinks = useMemo(() => {
        if (!event?.onlineLinks) return [];

        const all = [
            { key: 'instagram', label: 'Instagram', url: event.onlineLinks.instagram },
            { key: 'facebook', label: 'Facebook', url: event.onlineLinks.facebook },
            { key: 'youtube', label: 'YouTube', url: event.onlineLinks.youtube },
            { key: 'linkedin', label: 'LinkedIn', url: event.onlineLinks.linkedin },
            { key: 'website', label: 'Website', url: event.onlineLinks.website },
        ];

        return all
            .map((item) => ({
                ...item,
                safeUrl: sanitizeAbsoluteHttpUrl(item.url),
            }))
            .filter((item) => item.safeUrl);
    }, [event?.onlineLinks]);

    const safeTicketLink = sanitizeAbsoluteHttpUrl(event?.ticketLink || '');

    const openExternalLink = (url) => {
        const safeUrl = sanitizeAbsoluteHttpUrl(url);
        if (!safeUrl) return;
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
    };

    const structuredCoHostContacts = (Array.isArray(event?.coHostContacts) ? event.coHostContacts : [])
        .map((contact, index) => ({
            id: `cohost-structured-${String(contact?.user || '') || index}-${String(contact?.organisationId || '') || 'member'}`,
            name: String(contact?.displayName || '').trim(),
            avatar: sanitizeResolvedAssetUrl(API_URL, contact?.avatarUrl || ''),
            profileId: String(contact?.profileId || contact?.organisationId || contact?.user || '').trim(),
        }))
        .filter((contact) => contact.name);

    const legacyCoHostContacts = String(event?.coHosts || '')
        .split(',')
        .map((name, index) => ({
            id: `cohost-legacy-${index}`,
            name: name.trim(),
            avatar: '',
            profileId: attendeeUserIdByDisplayName[name.trim().toLowerCase()] || '',
        }))
        .filter((item) => item.name);

    const coHostContacts = structuredCoHostContacts.length > 0
        ? structuredCoHostContacts
        : legacyCoHostContacts;

    const primaryContactItems = isOrganisationPublisher
        ? [
            {
                id: 'publisher-organisation',
                name: organizerName,
                avatar: organizerAvatarUrl,
                profileId: publisherOrganisationId,
            },
            {
                id: 'organizer-member',
                name: organizerUserName,
                avatar: organizerUserAvatarUrl,
                profileId: organizerUserId,
            },
        ]
        : [
            {
                id: 'organizer-member',
                name: organizerUserName,
                avatar: organizerUserAvatarUrl,
                profileId: organizerUserId,
            },
        ];

    const contactItems = [...primaryContactItems, ...coHostContacts];

    const canReadMore = String(event?.description || '').length > 340;
    const overviewText = canReadMore && !isOverviewExpanded
        ? `${String(event?.description || '').slice(0, 340).trimEnd()}...`
        : String(event?.description || 'No description available.');

    if (isLoading) {
        return <div className="calendar-view-state">Loading event details...</div>;
    }

    if (error && !event) {
        return (
            <div className="calendar-view-state calendar-view-state-error">
                <p>{error}</p>
                <button type="button" className="calendar-view-back-button" onClick={() => navigate('/dashboard/calendar')}>
                    Back to calendar
                </button>
            </div>
        );
    }

    return (
        <div className="calendar-view-page">
            {error ? <p className="calendar-view-inline-error">{error}</p> : null}

            <div className="calendar-view-main">
                <section className="calendar-view-content">
                    <h1 className="calendar-view-title">{event?.title || 'Untitled event'}</h1>

                    <div className="calendar-view-host-row">
                        <button
                            type="button"
                            className="calendar-view-profile-trigger"
                            onClick={() => navigateToProfile(hostedByProfileId)}
                            disabled={!hostedByProfileId}
                            aria-label={`Open ${hostedByName} profile`}
                        >
                            <ProfileAvatar
                                firstName={organizerNameParts.firstName}
                                lastName={organizerNameParts.lastName}
                                avatarUrl={hostedByAvatarUrl}
                                size={50}
                                className="calendar-view-host-avatar"
                            />
                        </button>
                        <p>
                            Hosted by{' '}
                            {hostedByProfileId ? (
                                <button
                                    type="button"
                                    className="calendar-view-organizer-link"
                                    onClick={() => navigateToProfile(hostedByProfileId)}
                                >
                                    {hostedByName}
                                </button>
                            ) : (
                                <span>{hostedByName}</span>
                            )}
                        </p>
                    </div>

                    <section className="calendar-view-section">
                        <h2>Overview</h2>
                        <p className="calendar-view-overview-text">{overviewText}</p>

                        {canReadMore ? (
                            <button
                                type="button"
                                className="calendar-view-read-more"
                                onClick={() => setIsOverviewExpanded((current) => !current)}
                            >
                                {isOverviewExpanded ? 'Read less' : 'Read more'}
                            </button>
                        ) : null}
                    </section>

                    <section className="calendar-view-section">
                        <h2>Attendees</h2>
                        <div className="calendar-view-attendees-row">
                            <div className="calendar-view-avatar-stack">
                                {attendeeAvatars.map((avatarUrl, index) => (
                                    <img key={`${avatarUrl}-${index}`} src={avatarUrl} alt="" />
                                ))}
                            </div>
                            <button
                                type="button"
                                className="calendar-view-attendees-trigger"
                                onClick={openAttendeesPopup}
                            >
                                {attendeeCount} people are going
                            </button>
                        </div>
                    </section>

                    {shouldShowResellSection ? (
                        <section className="calendar-view-section">
                            <h2>Ticket Re-Sell</h2>
                            {isOwnEvent && event?.resellCondition === 'When tickets are sold-out' ? (
                                <div className="calendar-view-resell-manager">
                                    <p>Allow ticket-re-sell?</p>
                                    <div className="calendar-view-resell-manager-controls">
                                        <div
                                            ref={resellStatusDropdownRef}
                                            className={`calendar-view-resell-status-dropdown ${isResellStatusOpen ? 'open' : ''}`}
                                        >
                                            <button
                                                type="button"
                                                className="calendar-view-resell-status-trigger"
                                                onClick={() => setIsResellStatusOpen((current) => !current)}
                                                aria-expanded={isResellStatusOpen}
                                                aria-haspopup="listbox"
                                                aria-label="Sold out status"
                                            >
                                                <span>{getResellStatusOption(resellStatusDraft).label}</span>
                                                <span className="calendar-view-resell-status-caret">▾</span>
                                            </button>

                                            {isResellStatusOpen ? (
                                                <div className="calendar-view-resell-status-panel" role="listbox" aria-label="Select sold out status">
                                                    {RESOLD_STATUS_OPTIONS.map((option) => {
                                                        const isActive = resellStatusDraft === option.value;

                                                        return (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                role="option"
                                                                aria-selected={isActive}
                                                                className={`calendar-view-resell-status-option ${isActive ? 'active' : ''}`}
                                                                onMouseDown={(mouseEvent) => {
                                                                    mouseEvent.preventDefault();
                                                                    setResellStatusDraft(option.value);
                                                                    setIsResellStatusOpen(false);
                                                                }}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            className="calendar-view-contact-btn"
                                            onClick={handleUpdateResellAvailability}
                                            disabled={isResellAvailabilityPending}
                                        >
                                            {isResellAvailabilityPending ? 'Updating...' : 'Update'}
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            {!canUsersResell ? (
                                <p className="calendar-view-muted-copy">Ticket re-sell is hidden until this event is sold out.</p>
                            ) : null}

                            {canUsersResell ? (
                                <div className="calendar-view-resell-grid">
                                    {resellerCards.length > 0 ? resellerCards.map((reseller) => (
                                        <article key={reseller.id} className="calendar-view-resell-card">
                                            <button
                                                type="button"
                                                className="calendar-view-profile-trigger"
                                                onClick={() => navigateToProfile(reseller.userId)}
                                                aria-label={`Open ${reseller.name} profile`}
                                            >
                                                <ProfileAvatar
                                                    firstName={splitNameParts(reseller.name).firstName}
                                                    lastName={splitNameParts(reseller.name).lastName}
                                                    avatarUrl={reseller.avatar}
                                                    size={50}
                                                    className="calendar-view-resell-avatar"
                                                />
                                            </button>
                                            <div className="calendar-view-resell-copy">
                                                <h3>
                                                    <button
                                                        type="button"
                                                        className="calendar-view-name-link"
                                                        onClick={() => navigateToProfile(reseller.userId)}
                                                    >
                                                        {reseller.name}
                                                    </button>
                                                </h3>
                                                <p>Is selling {reseller.resaleTicketCount} ticket{reseller.resaleTicketCount === 1 ? '' : 's'}</p>
                                            </div>
                                            {reseller.isCurrentUser ? (
                                                <button
                                                    type="button"
                                                    className="btn-delete calendar-view-resell-delete-btn"
                                                    onClick={() => setIsDeleteResellPopupOpen(true)}
                                                >
                                                    <RecycleBin />
                                                    <span>Delete</span>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="calendar-view-contact-btn"
                                                    onClick={() => openMemberContactPopup(reseller.name, reseller.userId)}
                                                >
                                                    Contact
                                                    <MessageSquare className="calendar-view-contact-icon" />
                                                </button>
                                            )}
                                        </article>
                                    )) : (
                                        isOwnEvent ? (
                                            <p className="calendar-view-muted-copy">No one re-selling tickets yet.</p>
                                        ) : (
                                            <p className="calendar-view-muted-copy">
                                                No one re-selling tickets yet, be the first one to{' '}
                                                <button
                                                    type="button"
                                                    className="calendar-view-resell-link"
                                                    onClick={() => setIsResellPopupOpen(true)}
                                                >
                                                    re-sell ticket(s)
                                                </button>
                                                !
                                            </p>
                                        )
                                    )}

                                    {!isOwnEvent && resellerCards.length > 0 ? (
                                        <p className="calendar-view-muted-copy">
                                            {currentUserResellerCard
                                                ? 'Want to change your listing? '
                                                : 'Want to re-sell too? '}
                                            <button
                                                type="button"
                                                className="calendar-view-resell-link"
                                                onClick={() => setIsResellPopupOpen(true)}
                                            >
                                                {currentUserResellerCard ? 'Update re-sell ticket(s)' : 'Re-sell ticket(s)'}
                                            </button>
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}
                        </section>
                    ) : null}

                    {eventLinks.length > 0 ? (
                        <section className="calendar-view-section">
                            <h2>Event Links</h2>
                            <div className="calendar-view-social-links">
                                {eventLinks.map((link) => (
                                    <button
                                        type="button"
                                        key={link.key}
                                        className="calendar-view-social-link"
                                        aria-label={socialLabelByKey[link.key] || 'Event link'}
                                        title={socialLabelByKey[link.key] || 'Event link'}
                                        onClick={() => openExternalLink(link.safeUrl)}
                                    >
                                        <SocialLinkIcon type={link.key} />
                                    </button>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section className="calendar-view-section">
                        <h2>Contact</h2>
                        <div className="calendar-view-contact-list">
                            {contactItems.map((contact) => (
                                <div key={contact.id} className="calendar-view-contact-item">
                                    <button
                                        type="button"
                                        className="calendar-view-profile-trigger"
                                        onClick={() => navigateToProfile(contact.profileId)}
                                        disabled={!contact.profileId}
                                        aria-label={`Open ${contact.name} profile`}
                                    >
                                        <ProfileAvatar
                                            firstName={splitNameParts(contact.name).firstName}
                                            lastName={splitNameParts(contact.name).lastName}
                                            avatarUrl={contact.avatar}
                                            size={42}
                                            className="calendar-view-contact-avatar"
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        className="calendar-view-name-link"
                                        onClick={() => navigateToProfile(contact.profileId)}
                                        disabled={!contact.profileId}
                                    >
                                        {contact.name}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                </section>

                <aside className="calendar-view-sidebar">
                    <div className="calendar-view-cover">
                        <img src={eventImage} alt={event?.title || 'Event'} />
                    </div>

                    <section className="calendar-view-details-card">
                        <div className="calendar-view-detail-row">
                            <img src={calendarIcon} alt="" className="calendar-view-detail-icon" />
                            <p>{formatDateTimeRange(event)}</p>
                        </div>

                        <hr />

                        <div className="calendar-view-detail-row">
                            <img src={locationIcon} alt="" className="calendar-view-detail-icon" />
                            <p>
                                <strong>{event?.venue || 'Venue to be announced'}</strong>
                                <br />
                                <span>{event?.address || 'Address not specified'}</span>
                            </p>
                        </div>

                        <hr />

                        <div className="calendar-view-detail-row">
                            <img src={ticketIcon} alt="" className="calendar-view-detail-icon" />
                            <p>
                                <strong>Ticket</strong>
                                <br />
                                <span>{formatTicketText(event)} · {event?.ticketType === 'door' ? 'Pay at door' : 'Pre-paid'}</span>
                                <br />
                                {safeTicketLink ? (
                                    <button
                                        type="button"
                                        className="calendar-view-link-button"
                                        onClick={() => openExternalLink(safeTicketLink)}
                                    >
                                        Get Ticket
                                    </button>
                                ) : (
                                    <span className="calendar-view-muted-copy">No ticket link available</span>
                                )}
                            </p>
                        </div>

                        <hr />

                        <div className="calendar-view-detail-row">
                            <img src={bellIcon} alt="" className="calendar-view-detail-icon" />
                            <p>
                                <button type="button" className="calendar-view-link-button" onClick={openSubscribePopup}>Subscribe</button>
                                <br />
                                <span>Never miss an event from <strong>{organizerName}</strong>!</span>
                            </p>
                        </div>

                        {!isAdminUser ? (
                            <button
                                type="button"
                                className={`calendar-view-going-btn ${event?.isGoing ? 'is-active' : ''}`}
                                onClick={handleToggleGoing}
                                disabled={isGoingPending || isOwnEvent}
                            >
                                <CheckCircle className="calendar-view-going-icon" />
                                <span>{isOwnEvent ? 'You are hosting' : (isGoingPending ? 'Saving...' : (event?.isGoing ? 'Going' : 'Mark Going'))}</span>
                            </button>
                        ) : null}

                        {canDeleteEvent ? (
                            <div className="calendar-view-owner-actions">
                                {isOwnEvent ? (
                                    <button
                                        type="button"
                                        className="btn-edit"
                                        onClick={handleEditEvent}
                                    >
                                        <img src={editSquaredIcon} alt="" className="btn-edit-icon" />
                                        <span>Edit</span>
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    className="btn-delete"
                                    onClick={requestDeleteEvent}
                                    disabled={isDeletingEvent}
                                >
                                    <RecycleBin />
                                    <span>{isDeletingEvent ? 'Deleting...' : 'Delete'}</span>
                                </button>
                            </div>
                        ) : null}
                    </section>
                </aside>
            </div>

            <MemberContactPopup
                isOpen={isMemberContactPopupOpen}
                targetName={contactTargetName}
                targetUserId={contactTargetUserId}
                currentUser={user}
                apiUrl={API_URL}
                onClose={closeMemberContactPopup}
            />

            <AttendeesPopup
                isOpen={isAttendeesPopupOpen}
                onClose={closeAttendeesPopup}
                onViewProfile={navigateToProfile}
                attendees={attendeeProfiles}
                titlePrefix="People going to"
                highlightedTitle={event?.title || 'this event'}
            />

            {isResellPopupOpen ? (
                <div className="contact-popup-overlay" role="presentation" onMouseDown={closeResellPopup}>
                    <div
                        className="contact-popup calendar-view-resell-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="calendar-resell-popup-title"
                        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
                    >
                        <button className="contact-popup-close" type="button" onClick={closeResellPopup} aria-label="Close">
                            x
                        </button>

                        <h2 id="calendar-resell-popup-title" className="contact-popup-title calendar-view-resell-popup-title">
                            How many tickets are you re-selling?
                        </h2>

                        <div className="calendar-view-resell-popup-select-row">
                            <div
                                className="calendar-view-resell-count-dropdown"
                                onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
                            >
                                <button
                                    type="button"
                                    className={`calendar-view-resell-count-trigger ${isResellCountOpen ? 'open' : ''}`}
                                    onClick={() => {
                                        setIsResellCountOpen((current) => !current);
                                        setIsResellVisibilityOpen(false);
                                    }}
                                    aria-expanded={isResellCountOpen}
                                    aria-haspopup="listbox"
                                >
                                    <span>{resellTicketCount}</span>
                                    <span className="calendar-view-resell-count-caret">▾</span>
                                </button>

                                {isResellCountOpen ? (
                                    <div className="calendar-view-resell-count-panel" role="listbox" aria-label="Number of tickets to re-sell">
                                        {Array.from({ length: 10 }, (_, index) => String(index + 1)).map((count) => (
                                            <button
                                                key={count}
                                                type="button"
                                                role="option"
                                                aria-selected={resellTicketCount === count}
                                                className={`calendar-view-resell-count-option ${resellTicketCount === count ? 'active' : ''}`}
                                                onClick={() => {
                                                    setResellTicketCount(count);
                                                    setIsResellCountOpen(false);
                                                }}
                                            >
                                                {count}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                            <span>Ticket(s)</span>
                        </div>

                        <div className="calendar-view-resell-popup-select-row calendar-view-resell-popup-privacy-row">
                            <div
                                className={`calendar-view-resell-privacy-dropdown ${isResellVisibilityOpen ? 'open' : ''}`}
                                onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
                            >
                                <button
                                    type="button"
                                    className="calendar-view-resell-privacy-trigger"
                                    onClick={() => {
                                        setIsResellVisibilityOpen((current) => !current);
                                        setIsResellCountOpen(false);
                                    }}
                                    aria-expanded={isResellVisibilityOpen}
                                    aria-haspopup="listbox"
                                >
                                    <span className="calendar-view-resell-privacy-option-value">
                                        <img
                                            src={getResaleVisibilityOption(resellVisibilityDraft).icon}
                                            alt=""
                                            aria-hidden="true"
                                            className="calendar-view-resell-privacy-icon"
                                        />
                                        <span>{getResaleVisibilityOption(resellVisibilityDraft).label}</span>
                                    </span>
                                    <span className="calendar-view-resell-privacy-caret">▾</span>
                                </button>

                                {isResellVisibilityOpen ? (
                                    <div className="calendar-view-resell-privacy-panel" role="listbox" aria-label="Who can see your re-sell tickets">
                                        {RESALE_VISIBILITY_OPTIONS.map((option) => {
                                            const isActive = resellVisibilityDraft === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={isActive}
                                                    className={`calendar-view-resell-privacy-option ${isActive ? 'active' : ''}`}
                                                    onMouseDown={(mouseEvent) => {
                                                        mouseEvent.preventDefault();
                                                        setResellVisibilityDraft(option.value);
                                                        setIsResellVisibilityOpen(false);
                                                    }}
                                                >
                                                    <img src={option.icon} alt="" aria-hidden="true" className="calendar-view-resell-privacy-icon" />
                                                    <span>{option.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="contact-popup-actions calendar-view-resell-popup-actions">
                            <button
                                type="button"
                                className="contact-popup-submit"
                                onClick={handleSubmitResellTickets}
                                disabled={isResellSubmitPending}
                            >
                                {isResellSubmitPending ? 'Posting...' : 'Post'}
                            </button>
                            <button
                                type="button"
                                className="contact-popup-cancel"
                                onClick={closeResellPopup}
                                disabled={isResellSubmitPending}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {isDeleteResellPopupOpen ? (
                <div className="contact-popup-overlay" role="presentation" onClick={closeDeleteResellPopup}>
                    <div
                        className="contact-popup delete-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-resell-popup-title"
                        onClick={(clickEvent) => clickEvent.stopPropagation()}
                    >
                        <h2 id="delete-resell-popup-title" className="delete-popup-title">
                            Are you sure you want to delete yout ticket re-sell?
                        </h2>

                        <div className="delete-popup-actions">
                            <button
                                type="button"
                                className="delete-popup-confirm"
                                onClick={handleDeleteResellTickets}
                                disabled={isResellDeletePending}
                            >
                                {isResellDeletePending ? 'Deleting...' : 'Delete'}
                            </button>
                            <button
                                type="button"
                                className="delete-popup-cancel"
                                onClick={closeDeleteResellPopup}
                                disabled={isResellDeletePending}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {isDeletePopupOpen ? (
                <div className="contact-popup-overlay" role="presentation" onClick={closeDeletePopup}>
                    <div
                        className="contact-popup delete-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-popup-title"
                        onClick={(clickEvent) => clickEvent.stopPropagation()}
                    >
                        <h2 id="delete-popup-title" className="delete-popup-title">
                            Are you sure you want to delete this event? This Action can not be undone
                        </h2>

                        <div className="delete-popup-actions">
                            <button
                                type="button"
                                className="delete-popup-confirm"
                                onClick={confirmDeleteEvent}
                                disabled={isDeletingEvent}
                            >
                                {isDeletingEvent ? 'Deleting...' : 'Delete Event'}
                            </button>
                            <button
                                type="button"
                                className="delete-popup-cancel"
                                onClick={closeDeletePopup}
                                disabled={isDeletingEvent}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {isSubscribePopupOpen ? (
                <div className="contact-popup-overlay" role="presentation" onClick={closeSubscribePopup}>
                    <div
                        className="contact-popup delete-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="subscribe-popup-title"
                        onClick={(clickEvent) => clickEvent.stopPropagation()}
                    >
                        <h2 id="subscribe-popup-title" className="delete-popup-title">
                            Functionality will be added soon. Stay tuned
                        </h2>

                        <div className="delete-popup-actions">
                            <button
                                type="button"
                                className="delete-popup-cancel"
                                onClick={closeSubscribePopup}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
