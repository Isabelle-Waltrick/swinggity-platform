import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileAvatar from '../../../components/ProfileAvatar';
import CalendarEventCard from '../../calendar/components/CalendarEventCard';
import { buildCalendarEventCardModel } from '../../calendar/utils/eventCard';

const PLACEHOLDERS = {
    events: 'No events to show yet.',
    participants: 'No participants to show.',
};

const getOrganisationProfileId = (member) => String(member?.organisationId || member?.userId || '').trim();

export default function OrganisationProfileSection({ member, currentUser, apiUrl }) {
    const navigate = useNavigate();
    const [organisationEvents, setOrganisationEvents] = useState([]);
    const [isLoadingOrganisationEvents, setIsLoadingOrganisationEvents] = useState(false);
    const [organisationEventsError, setOrganisationEventsError] = useState('');
    const [goingEventIds, setGoingEventIds] = useState([]);

    const normalizedUserRole = String(currentUser?.role || '').trim().toLowerCase();
    const canMarkGoing = normalizedUserRole !== 'admin';
    const organisationProfileId = getOrganisationProfileId(member);

    const participantContacts = useMemo(() => {
        if (!Array.isArray(member?.participantContacts)) return [];

        return member.participantContacts
            .map((entry) => ({
                userId: String(entry?.userId || '').trim(),
                entityType: entry?.entityType === 'organisation' ? 'organisation' : 'member',
                organisationId: String(entry?.organisationId || '').trim(),
                displayName: String(entry?.displayName || '').trim(),
                avatarUrl: String(entry?.avatarUrl || '').trim(),
            }))
            .filter((entry) => entry.userId && entry.displayName);
    }, [member?.participantContacts]);

    useEffect(() => {
        let isCancelled = false;

        const fetchOrganisationEvents = async () => {
            if (!organisationProfileId) {
                setOrganisationEvents([]);
                setOrganisationEventsError('');
                setIsLoadingOrganisationEvents(false);
                return;
            }

            setIsLoadingOrganisationEvents(true);
            setOrganisationEventsError('');

            try {
                const response = await fetch(`${apiUrl}/api/calendar/events`, {
                    credentials: 'include',
                });
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load organisation events.');
                }

                const nextEvents = (Array.isArray(data.events) ? data.events : [])
                    .filter((event) => event?.publisherType === 'organisation' && String(event?.publisherOrganisationId || '').trim() === organisationProfileId);

                if (!isCancelled) {
                    setOrganisationEvents(nextEvents);
                }
            } catch (fetchError) {
                if (!isCancelled) {
                    setOrganisationEvents([]);
                    setOrganisationEventsError(fetchError.message || 'Unable to load organisation events.');
                }
            } finally {
                if (!isCancelled) {
                    setIsLoadingOrganisationEvents(false);
                }
            }
        };

        fetchOrganisationEvents();

        return () => {
            isCancelled = true;
        };
    }, [apiUrl, organisationProfileId]);

    const handleViewEvent = (eventId) => {
        const normalizedEventId = String(eventId || '').trim();
        if (!normalizedEventId) return;
        navigate(`/dashboard/calendar/${encodeURIComponent(normalizedEventId)}`);
    };

    const handleMarkEventGoing = async (eventId) => {
        const normalizedEventId = String(eventId || '').trim();
        if (!canMarkGoing || !normalizedEventId || goingEventIds.includes(normalizedEventId)) return;

        setGoingEventIds((previous) => [...previous, normalizedEventId]);
        try {
            const response = await fetch(`${apiUrl}/api/calendar/events/${encodeURIComponent(normalizedEventId)}/going`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success || !data.event) {
                throw new Error(data.message || 'Unable to mark attendance for this event.');
            }

            setOrganisationEvents((currentEvents) => currentEvents.map((event) => (
                String(event?.id || '').trim() === normalizedEventId ? data.event : event
            )));
        } catch (error) {
            window.alert(error.message || 'Unable to mark attendance for this event.');
        } finally {
            setGoingEventIds((previous) => previous.filter((id) => id !== normalizedEventId));
        }
    };

    const renderEvents = () => {
        if (isLoadingOrganisationEvents) {
            return <p className="profile-copy">Loading events...</p>;
        }

        if (organisationEventsError) {
            return <p className="profile-copy">{organisationEventsError}</p>;
        }

        if (organisationEvents.length === 0) {
            return <p className="profile-copy">{PLACEHOLDERS.events}</p>;
        }

        return (
            <ul className="profile-activity-feed" aria-label="Organisation events">
                {organisationEvents.map((event, index) => {
                    const cardEvent = buildCalendarEventCardModel(event, apiUrl, currentUser?._id, currentUser?.role);

                    return (
                        <li key={`${cardEvent.id || event?.id || 'organisation-event'}-${index}`} className="profile-activity-item profile-activity-item-event">
                            <CalendarEventCard
                                event={cardEvent}
                                canMarkGoing={canMarkGoing}
                                canEditEvent={false}
                                canDeleteEvent={false}
                                onView={handleViewEvent}
                                onOrganizerClick={(organizerId) => navigate(`/dashboard/members/${encodeURIComponent(organizerId)}`)}
                                onGoing={handleMarkEventGoing}
                                isGoingPending={goingEventIds.includes(cardEvent.id)}
                            />
                        </li>
                    );
                })}
            </ul>
        );
    };

    const renderParticipants = () => {
        if (participantContacts.length === 0) {
            return <p className="profile-copy">{PLACEHOLDERS.participants}</p>;
        }

        return (
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
        );
    };

    return (
        <>
            <div className="profile-section-heading">
                <h2>Events</h2>
            </div>
            {renderEvents()}

            <div className="profile-section-heading">
                <h2>Participants</h2>
            </div>
            {renderParticipants()}
        </>
    );
}
