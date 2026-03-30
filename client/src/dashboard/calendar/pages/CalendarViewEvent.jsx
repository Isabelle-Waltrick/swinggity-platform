import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import MemberContactPopup from '../../../components/MemberContactPopup';
import ProfileAvatar from '../../../components/ProfileAvatar';
import { CheckCircle } from '../components/CheckCircle';
import { MessageSquare } from '../components/MessageSquare';
import bellIcon from '../../../assets/bell-icon.png';
import calendarIcon from '../../../assets/calendar-icon.png';
import defaultEventBackground from '../../../assets/event-background-default.png';
import facebookIcon from '../../../assets/facebook-icon.svg';
import instagramIcon from '../../../assets/instagram-icon.svg';
import linkedinIcon from '../../../assets/likedin-icon.svg';
import locationIcon from '../../../assets/location-icon.png';
import ticketIcon from '../../../assets/ticket-icon.png';
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
};

const SocialLinkIcon = ({ type }) => {
    if (type === 'website') {
        return <span className="calendar-view-social-globe" aria-hidden="true">www</span>;
    }

    const src = socialIconByKey[type];
    if (!src) return null;

    return <img src={src} alt="" />;
};

export default function CalendarViewEventPage() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const [event, setEvent] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isGoingPending, setIsGoingPending] = useState(false);
    const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
    const [isMemberContactPopupOpen, setIsMemberContactPopupOpen] = useState(false);
    const [contactTargetName, setContactTargetName] = useState('');
    const [contactTargetUserId, setContactTargetUserId] = useState('');
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

    const handleToggleGoing = async () => {
        if (!event || isGoingPending || isOwnEvent) return;

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

    const eventImage = FALLBACK_EVENT_IMAGE;
    const organizerName = String(event?.organizerName || 'Swinggity Host').trim();
    const organizerAvatarUrl = sanitizeResolvedAssetUrl(API_URL, event?.organizerAvatarUrl || '');
    const organizerUserId = String(event?.createdById || '').trim();
    const isOwnEvent = String(user?._id || '').trim() === organizerUserId;
    const organizerNameParts = splitNameParts(organizerName);
    const attendees = Array.isArray(event?.attendees) ? event.attendees : [];
    const attendeeCount = Number.isFinite(event?.attendeesCount) ? event.attendeesCount : attendees.length;

    const attendeeUserIdByDisplayName = attendees.reduce((accumulator, attendee) => {
        const displayName = String(attendee?.displayName || '').trim().toLowerCase();
        const userId = String(attendee?.userId || '').trim();
        if (!displayName || !userId || accumulator[displayName]) return accumulator;
        accumulator[displayName] = userId;
        return accumulator;
    }, {});

    const navigateToMemberProfile = (userId) => {
        const normalizedUserId = String(userId || '').trim();
        if (!normalizedUserId) return;
        navigate(`/dashboard/members/${encodeURIComponent(normalizedUserId)}`);
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

    const attendeeAvatars = attendees
        .map((attendee) => sanitizeResolvedAssetUrl(API_URL, attendee?.avatarUrl || ''))
        .filter(Boolean)
        .slice(0, 3);

    const resellerCards = attendees
        .filter((attendee) => String(attendee?.userId || '') !== String(user?._id || ''))
        .slice(0, 2)
        .map((attendee, index) => ({
            id: `${attendee.userId}-${index}`,
            userId: String(attendee?.userId || '').trim(),
            avatar: sanitizeResolvedAssetUrl(API_URL, attendee?.avatarUrl || ''),
            name: String(attendee?.displayName || '').trim() || 'Swinggity Member',
            description: index === 0 ? 'Is selling 1 ticket' : 'Is selling 2 tickets',
        }));

    const eventLinks = useMemo(() => {
        if (!event?.socialLinks) return [];

        const all = [
            { key: 'instagram', label: 'Instagram', url: event.socialLinks.instagram },
            { key: 'facebook', label: 'Facebook', url: event.socialLinks.facebook },
            { key: 'youtube', label: 'YouTube', url: event.socialLinks.youtube },
            { key: 'linkedin', label: 'LinkedIn', url: event.socialLinks.linkedin },
            { key: 'website', label: 'Website', url: event.socialLinks.website },
        ];

        return all
            .map((item) => ({
                ...item,
                safeUrl: sanitizeAbsoluteHttpUrl(item.url),
            }))
            .filter((item) => item.safeUrl);
    }, [event?.socialLinks]);

    const safeTicketLink = sanitizeAbsoluteHttpUrl(event?.ticketLink || '');

    const contactItems = [
        {
            id: 'organizer',
            name: organizerName,
            avatar: organizerAvatarUrl,
            userId: organizerUserId,
        },
        ...String(event?.coHosts || '')
            .split(',')
            .map((name, index) => ({
                id: `cohost-${index}`,
                name: name.trim(),
                avatar: '',
                userId: attendeeUserIdByDisplayName[name.trim().toLowerCase()] || '',
            }))
            .filter((item) => item.name),
    ];

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
                            onClick={() => navigateToMemberProfile(organizerUserId)}
                            disabled={!organizerUserId}
                            aria-label={`Open ${organizerName} profile`}
                        >
                            <ProfileAvatar
                                firstName={organizerNameParts.firstName}
                                lastName={organizerNameParts.lastName}
                                avatarUrl={organizerAvatarUrl}
                                size={50}
                                className="calendar-view-host-avatar"
                            />
                        </button>
                        <p>
                            Hosted by{' '}
                            <button
                                type="button"
                                className="calendar-view-organizer-link"
                                onClick={() => navigateToMemberProfile(organizerUserId)}
                            >
                                {organizerName}
                            </button>
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
                                {attendeeAvatars.length > 0 ? attendeeAvatars.map((avatarUrl, index) => (
                                    <img key={`${avatarUrl}-${index}`} src={avatarUrl} alt="" />
                                )) : (
                                    <>
                                        <span className="calendar-view-avatar-placeholder"></span>
                                        <span className="calendar-view-avatar-placeholder dark"></span>
                                        <span className="calendar-view-avatar-placeholder mid"></span>
                                    </>
                                )}
                            </div>
                            <p>{attendeeCount} people are going</p>
                        </div>
                    </section>

                    {event?.allowResell === 'yes' ? (
                        <section className="calendar-view-section">
                            <h2>Ticket Re-Sell</h2>
                            <div className="calendar-view-resell-grid">
                                {resellerCards.length > 0 ? resellerCards.map((reseller) => (
                                    <article key={reseller.id} className="calendar-view-resell-card">
                                        <button
                                            type="button"
                                            className="calendar-view-profile-trigger"
                                            onClick={() => navigateToMemberProfile(reseller.userId)}
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
                                                    onClick={() => navigateToMemberProfile(reseller.userId)}
                                                >
                                                    {reseller.name}
                                                </button>
                                            </h3>
                                            <p>{reseller.description}</p>
                                        </div>
                                        <button
                                            type="button"
                                            className="calendar-view-contact-btn"
                                            onClick={() => openMemberContactPopup(reseller.name, reseller.userId)}
                                        >
                                            Contact
                                            <MessageSquare className="calendar-view-contact-icon" />
                                        </button>
                                    </article>
                                )) : <p className="calendar-view-muted-copy">No tickets currently listed for re-sale.</p>}
                            </div>
                        </section>
                    ) : null}

                    {eventLinks.length > 0 ? (
                        <section className="calendar-view-section">
                            <h2>Event Links</h2>
                            <div className="calendar-view-social-links">
                                {eventLinks.map((link) => (
                                    <span
                                        key={link.key}
                                        className="calendar-view-social-link"
                                        aria-label={link.label}
                                        title={link.label}
                                    >
                                        <SocialLinkIcon type={link.key} />
                                    </span>
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
                                        onClick={() => navigateToMemberProfile(contact.userId)}
                                        disabled={!contact.userId}
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
                                        onClick={() => navigateToMemberProfile(contact.userId)}
                                        disabled={!contact.userId}
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
                                    <span className="calendar-view-link-button">Get Ticket</span>
                                ) : (
                                    <span className="calendar-view-muted-copy">No ticket link available</span>
                                )}
                            </p>
                        </div>

                        <hr />

                        <div className="calendar-view-detail-row">
                            <img src={bellIcon} alt="" className="calendar-view-detail-icon" />
                            <p>
                                <button type="button" className="calendar-view-link-button">Subscribe</button>
                                <br />
                                <span>Never miss an event from <strong>{organizerName}</strong>!</span>
                            </p>
                        </div>

                        <button
                            type="button"
                            className={`calendar-view-going-btn ${event?.isGoing ? 'is-active' : ''}`}
                            onClick={handleToggleGoing}
                            disabled={isGoingPending || isOwnEvent}
                        >
                            <CheckCircle className="calendar-view-going-icon" />
                            <span>{isOwnEvent ? 'You are hosting' : (isGoingPending ? 'Saving...' : (event?.isGoing ? 'Going' : 'Mark Going'))}</span>
                        </button>
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
        </div>
    );
}
