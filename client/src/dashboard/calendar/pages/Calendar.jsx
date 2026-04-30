// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Page Guide
 * Main dashboard page for calendar browsing and high-level user interactions.
 * It usually orchestrates data loading, filters, and child component composition.
 */

/**
 * Calendar Page
 * Main dashboard page for browsing, filtering, and managing calendar events.
 * Handles geolocation-based city detection, multiple filter controls, event display,
 * event creation/deletion workflows, and organiser verification requests.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import AttendeesPopup from '../../../components/AttendeesPopup';
import { MapPin } from "../components/MapPin";
import { Plus } from "../components/Plus";
import CalendarEventCard from "../components/CalendarEventCard";
import { buildCalendarEventCardModel } from "../utils/eventCard";

// Stylesheet for calendar page; includes layout and component-specific styles.
import "../styles/Calendar.css";

// Category icons render filter buttons with visual representations.
import allIcon from "../../../assets/All-Not-Selected.svg";
import socialsIcon from "../../../assets/Socials-Not-Selected.svg";
import classesIcon from "../../../assets/Classes-Not-Selected.svg";
import workshopsIcon from "../../../assets/workshops-not-selected.svg";
import festivalsIcon from "../../../assets/Festivals_Not_Selected.svg";

// Category filter options map front-end display names to back-end event type values.
const CATEGORY_TO_EVENT_TYPE = {
    Socials: 'Social',
    Classes: 'Class',
    Workshops: 'Workshop',
    Festivals: 'Festival',
};

// Contact message validation: limits message text to a reasonable length.
const CONTACT_MESSAGE_MAX_WORDS = 200;

// Word counting utility for contact message validation.
const countWords = (value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) return 0;
    return normalized.split(/\s+/).length;
};

// ISO date string validation matches YYYY-MM-DD format as used by date inputs.
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Normalize and validate ISO date strings; return empty if invalid.
const normalizeIsoDate = (value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!ISO_DATE_REGEX.test(normalized)) return '';
    return normalized;
};

// Normalize city text for case-insensitive matching.
const normalizeCityText = (value) => String(value || '').trim().toLowerCase();

// Generate multiple matching terms from city names to handle "Greater X" or "City of X" variations.
const getCityMatchTerms = (value) => {
    const normalized = normalizeCityText(value);
    if (!normalized) return [];

    const terms = new Set([normalized]);
    const withoutGreater = normalized.replace(/^greater\s+/, '').trim();
    const withoutCityOf = normalized.replace(/^city\s+of\s+/, '').trim();

    if (withoutGreater) terms.add(withoutGreater);
    if (withoutCityOf) terms.add(withoutCityOf);

    return Array.from(terms).filter(Boolean);
};

// Check if an event's address/city/venue matches the selected city filter.
const eventMatchesCity = (event, selectedCity) => {
    const cityTerms = getCityMatchTerms(selectedCity);
    if (cityTerms.length === 0) return true;

    const address = normalizeCityText(event?.address);
    const eventCity = normalizeCityText(event?.city);
    const venue = normalizeCityText(event?.venue);

    return cityTerms.some((cityTerm) => (
        address.includes(cityTerm) || eventCity.includes(cityTerm) || venue.includes(cityTerm)
    ));
};

export default function CalendarPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Role-derived flags control event creation and marking actions.
    const normalizedUserRole = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : '';
    const canCreateEvent = normalizedUserRole === 'organiser' || normalizedUserRole === 'organizer' || normalizedUserRole === 'admin';
    const canMarkGoing = normalizedUserRole !== 'admin';

    // API base url supports both local development and deployed environments.
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    // Category filter state tracks which event type is currently displayed.
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Location filter state: detects user's city and allows manual override.
    const [location, setLocation] = useState('Detecting city...');
    const [isLocationFilterActive, setIsLocationFilterActive] = useState(false);
    const [locationQuery, setLocationQuery] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState([]);
    const [locationError, setLocationError] = useState('');
    const [isLocationLoading, setIsLocationLoading] = useState(false);

    // Calendar events state tracks fetched events and error conditions.
    const [events, setEvents] = useState([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(true);
    const [eventsError, setEventsError] = useState('');

    // Delete event state tracks which event is pending deletion and confirms action.
    const [deletingEventId, setDeletingEventId] = useState('');
    const [pendingDeleteEventId, setPendingDeleteEventId] = useState('');
    const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);

    // Attendance marking state tracks in-flight "going" requests.
    const [goingEventIds, setGoingEventIds] = useState([]);

    // Popup state for displaying attendees and contact forms.
    const [attendeesPopupEvent, setAttendeesPopupEvent] = useState(null);
    const [isContactPopupOpen, setIsContactPopupOpen] = useState(false);
    const [contactMessage, setContactMessage] = useState('');
    const [allowEmailContact, setAllowEmailContact] = useState(false);
    const [allowPhoneContact, setAllowPhoneContact] = useState(false);
    const [contactPopupError, setContactPopupError] = useState('');
    const [isSendingContactRequest, setIsSendingContactRequest] = useState(false);
    const [isContactRequestSubmitted, setIsContactRequestSubmitted] = useState(false);

    // Dropdown refs enable detection of outside clicks to close dropdowns.
    const filterControlsRef = useRef(null);
    const dateDropdownRef = useRef(null);
    const locationDropdownRef = useRef(null);
    const organiserDropdownRef = useRef(null);
    const genreDropdownRef = useRef(null);
    const musicFormatDropdownRef = useRef(null);

    // Each filter uses "temp" state inside the open panel and commits to "selected" state on Apply.
    // This prevents half-finished choices from changing the visible filter chips immediately.
    const [isLocationOpen, setIsLocationOpen] = useState(false);
    const [isDateOpen, setIsDateOpen] = useState(false);
    const [tempDateStart, setTempDateStart] = useState('');
    const [tempDateEnd, setTempDateEnd] = useState('');
    const [selectedDateStart, setSelectedDateStart] = useState('');
    const [selectedDateEnd, setSelectedDateEnd] = useState('');

    // Organiser filter: temp and selected states for checkbox selection.
    const [isOrganiserOpen, setIsOrganiserOpen] = useState(false);
    const [tempOrganisers, setTempOrganisers] = useState([]);
    const [selectedOrganisers, setSelectedOrganisers] = useState([]);

    // Genre filter: full list and selected subset.
    const [isGenreOpen, setIsGenreOpen] = useState(false);
    const genreOptions = ['Lindy Hop', 'Collegiate Shag', 'Balboa', 'Jive', 'Boogie Woogie', 'West/East Coast', 'Charleston'];
    const [tempGenres, setTempGenres] = useState([...genreOptions]);
    const [selectedGenres, setSelectedGenres] = useState([...genreOptions]);

    // Music format filter: radio selection (mutually exclusive).
    const [isMusicFormatOpen, setIsMusicFormatOpen] = useState(false);
    const musicFormatOptions = ['Both', 'DJ', 'Live music'];
    const [tempMusicFormat, setTempMusicFormat] = useState('Both');
    const [selectedMusicFormat, setSelectedMusicFormat] = useState('Both');

    // Keep only one dropdown open at a time for a cleaner, predictable interaction pattern.
    const closeAllDropdowns = () => {
        setIsLocationOpen(false);
        setIsDateOpen(false);
        setIsOrganiserOpen(false);
        setIsGenreOpen(false);
        setIsMusicFormatOpen(false);
    };

    // Toggle the specified dropdown or close it if already open.
    const toggleDropdown = (dropdown) => {
        const wasOpen = {
            location: isLocationOpen,
            date: isDateOpen,
            organiser: isOrganiserOpen,
            genre: isGenreOpen,
            musicFormat: isMusicFormatOpen
        }[dropdown];

        closeAllDropdowns();

        if (!wasOpen) {
            if (dropdown === 'location') setIsLocationOpen(true);
            if (dropdown === 'date') setIsDateOpen(true);
            if (dropdown === 'organiser') setIsOrganiserOpen(true);
            if (dropdown === 'genre') setIsGenreOpen(true);
            if (dropdown === 'musicFormat') setIsMusicFormatOpen(true);
        }
    };

    // Close dropdowns when clicking outside, maintaining one-open-at-a-time UX pattern.
    useEffect(() => {
        const handleDocumentMouseDown = (event) => {
            const hasOpenDropdown = isLocationOpen || isDateOpen || isOrganiserOpen || isGenreOpen || isMusicFormatOpen;
            if (!hasOpenDropdown) return;

            const clickedInsideLocation = locationDropdownRef.current?.contains(event.target);
            const clickedInsideDate = dateDropdownRef.current?.contains(event.target);
            const clickedInsideOrganiser = organiserDropdownRef.current?.contains(event.target);
            const clickedInsideGenre = genreDropdownRef.current?.contains(event.target);
            const clickedInsideMusicFormat = musicFormatDropdownRef.current?.contains(event.target);

            if (!clickedInsideLocation && !clickedInsideDate && !clickedInsideOrganiser && !clickedInsideGenre && !clickedInsideMusicFormat) {
                closeAllDropdowns();
            }
        };

        document.addEventListener('mousedown', handleDocumentMouseDown);
        return () => {
            document.removeEventListener('mousedown', handleDocumentMouseDown);
        };
    }, [isLocationOpen, isDateOpen, isOrganiserOpen, isGenreOpen, isMusicFormatOpen]);

    // Initialize city detection: attempt geolocation, fall back to timezone, then fallback city.
    useEffect(() => {
        let isCancelled = false;

        const deriveCityFromTimeZone = () => {
            try {
                const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
                const zoneParts = zone.split('/');
                const cityPart = zoneParts[zoneParts.length - 1] || '';
                return cityPart.replaceAll('_', ' ').trim();
            } catch {
                return '';
            }
        };

        const loadCurrentCity = () => {
            if (!navigator.geolocation) {
                // Geolocation not available; fall back to timezone-derived city.
                const fallback = deriveCityFromTimeZone() || 'London';
                if (!isCancelled) {
                    setLocation(fallback);
                    setIsLocationFilterActive(true);
                }
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position?.coords?.latitude;
                    const lon = position?.coords?.longitude;
                    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                        // Invalid coordinates; fall back to timezone-derived city.
                        if (!isCancelled) {
                            setLocation(deriveCityFromTimeZone() || 'London');
                            setIsLocationFilterActive(true);
                        }
                        return;
                    }

                    try {
                        // Use reverse geocoding API to resolve city from lat/lon.
                        const response = await fetch(
                            `${API_URL}/api/calendar/cities/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
                            { credentials: 'include' }
                        );
                        const data = await response.json();
                        if (!response.ok || !data.success) {
                            throw new Error(data.message || 'Unable to resolve city.');
                        }

                        const nextCity = String(data.city || '').trim() || deriveCityFromTimeZone() || 'London';
                        if (!isCancelled) {
                            setLocation(nextCity);
                            setIsLocationFilterActive(true);
                        }
                    } catch {
                        // API error; fall back to timezone-derived city.
                        if (!isCancelled) {
                            setLocation(deriveCityFromTimeZone() || 'London');
                            setIsLocationFilterActive(true);
                        }
                    }
                },
                () => {
                    // Geolocation permission denied; fall back to timezone-derived city.
                    if (!isCancelled) {
                        setLocation(deriveCityFromTimeZone() || 'London');
                        setIsLocationFilterActive(true);
                    }
                },
                {
                    enableHighAccuracy: false,
                    maximumAge: 10 * 60 * 1000,
                    timeout: 8000,
                }
            );
        };

        loadCurrentCity();

        return () => {
            isCancelled = true;
        };
    }, [API_URL]);

    // Fetch city autocomplete suggestions as user types in location filter.
    useEffect(() => {
        if (!isLocationOpen) {
            setLocationSuggestions([]);
            setLocationError('');
            setIsLocationLoading(false);
            return undefined;
        }

        const query = locationQuery.trim();
        if (query.length < 1) {
            setLocationSuggestions([]);
            setLocationError('');
            setIsLocationLoading(false);
            return undefined;
        }

        // Debounce autocomplete requests to avoid excessive API calls.
        const controller = new AbortController();
        const timeoutId = window.setTimeout(async () => {
            setIsLocationLoading(true);
            setLocationError('');

            try {
                const response = await fetch(
                    `${API_URL}/api/calendar/cities/autocomplete?input=${encodeURIComponent(query)}`,
                    {
                        credentials: 'include',
                        signal: controller.signal,
                    }
                );
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load cities.');
                }

                setLocationSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
            } catch (error) {
                if (error.name === 'AbortError') return;
                setLocationSuggestions([]);
                setLocationError(error.message || 'Unable to load cities.');
            } finally {
                setIsLocationLoading(false);
            }
        }, 220);

        return () => {
            controller.abort();
            window.clearTimeout(timeoutId);
        };
    }, [API_URL, isLocationOpen, locationQuery]);

    // Manage body scroll lock when popups are open and handle Escape key to close them.
    useEffect(() => {
        if (!isContactPopupOpen && !isDeletePopupOpen) return undefined;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsContactPopupOpen(false);
                setIsDeletePopupOpen(false);
                setPendingDeleteEventId('');
            }
        };

        document.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = originalOverflow;
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isContactPopupOpen, isDeletePopupOpen]);

    // Map category names to their respective icons for the filter bar.
    const categoryIcons = {
        'All': allIcon,
        'Socials': socialsIcon,
        'Classes': classesIcon,
        'Workshops': workshopsIcon,
        'Festivals': festivalsIcon
    };

    // FR21: Fetch all calendar events on mount so the calendar overview page is populated for all authenticated roles.
    useEffect(() => {
        const fetchCalendarEvents = async () => {
            setIsLoadingEvents(true);
            setEventsError('');
            try {
                const response = await fetch(`${API_URL}/api/calendar/events`, {
                    credentials: 'include',
                });
                const data = await response.json().catch(() => ({}));

                // Detect session expiration and redirect to login.
                const isSessionExpired = response.status === 401
                    || (response.status === 404 && String(data?.message || '').toLowerCase().includes('user not found'));

                if (isSessionExpired) {
                    setEvents([]);
                    setEventsError('Your session has expired. Please log in again.');
                    navigate('/login', { replace: true });
                    return;
                }

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load events.');
                }

                setEvents(Array.isArray(data.events) ? data.events : []);
            } catch (error) {
                setEventsError(error.message || 'Unable to load events.');
                setEvents([]);
            } finally {
                setIsLoadingEvents(false);
            }
        };

        fetchCalendarEvents();
    }, [API_URL, navigate]);

    // Extract unique organiser names from all events to populate the organiser filter dropdown.
    const organiserOptions = useMemo(() => ([...new Set(
        events
            .map((event) => String(event.organizerName || '').trim())
            .filter(Boolean)
    )]), [events]);

    // Initialize or synchronize organiser filter selections when available organisers change.
    useEffect(() => {
        if (organiserOptions.length === 0) {
            setTempOrganisers([]);
            setSelectedOrganisers([]);
            return;
        }

        setTempOrganisers((previous) => {
            if (previous.length === 0) return [...organiserOptions];
            // Keep previously selected organisers that still exist; if none remain, select all.
            const kept = previous.filter((item) => organiserOptions.includes(item));
            return kept.length === 0 ? [...organiserOptions] : kept;
        });

        setSelectedOrganisers((previous) => {
            if (previous.length === 0) return [...organiserOptions];
            // Keep previously selected organisers that still exist; if none remain, select all.
            const kept = previous.filter((item) => organiserOptions.includes(item));
            return kept.length === 0 ? [...organiserOptions] : kept;
        });
    }, [organiserOptions]);

    // Initiate event deletion workflow: show confirmation popup.
    const requestDeleteEvent = (eventId) => {
        if (!eventId || deletingEventId) return;

        setPendingDeleteEventId(String(eventId));
        setIsDeletePopupOpen(true);
        setEventsError('');
    };
    // Close delete popup without confirming; disabled during deletion.
    const closeDeletePopup = () => {
        if (deletingEventId) return;
        setIsDeletePopupOpen(false);
        setPendingDeleteEventId('');
    };
    // Confirm event deletion after user approves in popup.
    const confirmDeleteEvent = async () => {
        const eventId = pendingDeleteEventId;
        if (!eventId || deletingEventId) return;
        // Set the event being deleted to disable interactions and show loading state in the popup.
        setDeletingEventId(eventId);
        setIsDeletePopupOpen(false);
        setEventsError('');
        try {
            const response = await fetch(`${API_URL}/api/calendar/events/${encodeURIComponent(eventId)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to delete event.');
            }
            // Remove deleted event from the visible list.
            setEvents((current) => current.filter((item) => String(item.id || '') !== String(eventId)));
        } catch (error) {
            setEventsError(error.message || 'Unable to delete event.');
        } finally {
            setDeletingEventId('');
            setPendingDeleteEventId('');
        }
    };
    // Navigate to event edit page.
    const handleEditEvent = (eventId) => {
        if (!eventId) return;
        navigate(`/dashboard/calendar/edit/${encodeURIComponent(eventId)}`);
    };
    // Navigate to event detail page.
    const handleViewEvent = (eventId) => {
        if (!eventId) return;
        navigate(`/dashboard/calendar/${encodeURIComponent(eventId)}`);
    };
    // Navigate to organiser's profile page.
    const handleOrganizerProfileClick = (organizerId) => {
        if (!organizerId) return;
        navigate(`/dashboard/members/${encodeURIComponent(String(organizerId))}`);
    };
    // FR24: Opens the attendees popup so any user/organiser/admin can see who is going to the event.
    const openAttendeesPopup = (popupEvent) => {
        if (!popupEvent) return;

        setAttendeesPopupEvent({
            title: String(popupEvent.title || '').trim() || 'this event',
            attendees: Array.isArray(popupEvent.attendees) ? popupEvent.attendees : [],
        });
    };
    // Close attendees popup.
    const closeAttendeesPopup = () => {
        setAttendeesPopupEvent(null);
    };
    // FR22: Sends POST to /going endpoint to mark the user as attending; admin role is excluded.
    // FR23: The same POST toggles the state — if already going, the backend removes the attendee record.
    const handleMarkGoing = async (eventId) => {
        const normalizedEventId = String(eventId || '');
        if (!canMarkGoing || !normalizedEventId || goingEventIds.includes(normalizedEventId)) return;

        // Optimistically add to pending list.
        setGoingEventIds((previous) => [...previous, normalizedEventId]);
        setEventsError('');

        try {
            const response = await fetch(`${API_URL}/api/calendar/events/${encodeURIComponent(normalizedEventId)}/going`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success || !data.event) {
                throw new Error(data.message || 'Unable to mark attendance for this event.');
            }
            // Update the event with the latest attendee data from server.
            setEvents((current) => current.map((item) => (
                String(item.id || '') === normalizedEventId ? data.event : item
            )));
        } catch (error) {
            setEventsError(error.message || 'Unable to mark attendance for this event.');
        } finally {
            // Remove from pending list.
            setGoingEventIds((previous) => previous.filter((id) => id !== normalizedEventId));
        }
    };

    // Available event categories for filtering.
    const categories = ['All', 'Socials', 'Classes', 'Workshops', 'Festivals'];
    // Filter and transform events based on all active filters; build display-ready card models.
    const visibleEvents = events
        // FR25: Filter events by location — matches against event address, city, or venue using geolocation-resolved city.
        .filter((event) => !isLocationFilterActive || eventMatchesCity(event, location))
        // FR30: Filter events by event type category (Socials, Classes, Workshops, Festivals, or All).
        .filter((event) => {
            if (selectedCategory === 'All') return true;
            return event.eventType === CATEGORY_TO_EVENT_TYPE[selectedCategory];
        })
        // FR26: Filter events by date range using start and/or end date pickers.
        .filter((event) => {
            const eventDate = normalizeIsoDate(event.startDate);
            if (!eventDate) return false;

            if (selectedDateStart && eventDate < selectedDateStart) return false;
            if (selectedDateEnd && eventDate > selectedDateEnd) return false;
            return true;
        })
        // FR29: Filter events by music format (Both / DJ / Live music).
        .filter((event) => {
            if (selectedMusicFormat === 'Both') return true;
            return String(event.musicFormat || '') === selectedMusicFormat;
        })
        // FR27: Filter events by organiser name; checkbox list derived from all event organisers.
        .filter((event) => {
            if (selectedOrganisers.length === organiserOptions.length) return true;
            if (selectedOrganisers.length === 0) return true;
            return selectedOrganisers.includes(String(event.organizerName || ''));
        })
        // FR28: Filter events by swing dance genre(s); events with any matching genre are included.
        .filter((event) => {
            if (selectedGenres.length === genreOptions.length) return true;
            if (selectedGenres.length === 0) return true;

            const eventGenres = Array.isArray(event.genres) ? event.genres : [];
            return eventGenres.some((genre) => selectedGenres.includes(genre));
        })
        .map((event) => buildCalendarEventCardModel({
            ...event,
            organizerProfileId: event.publisherType === 'organisation'
                ? String(event.publisherOrganisationId || '').trim()
                : String(event.createdById || '').trim(),
        }, API_URL, user?._id, user?.role));

    // Format a date string for display in filter label (e.g., "28 Apr 2026").
    const formatDateLabel = (value) => {
        if (!value) return '';

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return '';
        }

        return parsed.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    // Generate date range label for the filter button based on selected start/end dates.
    const getDateRangeLabel = () => {
        const startLabel = formatDateLabel(selectedDateStart);
        const endLabel = formatDateLabel(selectedDateEnd);

        if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
        if (startLabel) return `From ${startLabel}`;
        if (endLabel) return `Until ${endLabel}`;
        return 'Date';
    };

    // Commit temp date selections to permanent filter state.
    const applyDateSelection = () => {
        setSelectedDateStart(tempDateStart);
        setSelectedDateEnd(tempDateEnd);
        setIsDateOpen(false);
    };

    // Clear date selections and close filter panel.
    const clearDateSelection = () => {
        setTempDateStart('');
        setTempDateEnd('');
        setSelectedDateStart('');
        setSelectedDateEnd('');
        setIsDateOpen(false);
    };

    // Separate visible events into upcoming (future) and past sections based on event start time.
    const now = Date.now();
    const upcomingEvents = visibleEvents.filter((event) => {
        const eventDateTime = new Date(`${event.startDate || ''}T${event.startTime || '00:00'}`);
        if (Number.isNaN(eventDateTime.getTime())) return true;
        return eventDateTime.getTime() >= now;
    });

    const pastEvents = visibleEvents.filter((event) => {
        const eventDateTime = new Date(`${event.startDate || ''}T${event.startTime || '00:00'}`);
        if (Number.isNaN(eventDateTime.getTime())) return false;
        return eventDateTime.getTime() < now;
    });

    // Determine if all organisers are currently selected in the temp filter state.
    const isAllTempSelected = tempOrganisers.length === organiserOptions.length;

    // Generate label for organiser filter button based on current selection.
    const getOrganiserLabel = () => {
        if (selectedOrganisers.length === organiserOptions.length) {
            return 'All Organisers';
        }

        if (selectedOrganisers.length === 0) {
            return 'All Organisers';
        }

        if (selectedOrganisers.length === 1) {
            return selectedOrganisers[0];
        }

        return `${selectedOrganisers.length} Organisers`;
    };

    // Toggle organiser selection; "All Organisers" acts as select-all/select-none.
    const toggleOrganiserOption = (option) => {
        // "All Organisers" behaves like a select-all/select-none shortcut.
        if (option === 'All Organisers') {
            setTempOrganisers(isAllTempSelected ? [] : [...organiserOptions]);
            return;
        }

        setTempOrganisers((prev) =>
            prev.includes(option)
                ? prev.filter((item) => item !== option)
                : [...prev, option]
        );
    };

    // Commit temp organiser selections to permanent filter state.
    const applyOrganiserSelection = () => {
        setSelectedOrganisers([...tempOrganisers]);
        setIsOrganiserOpen(false);
    };

    // Reset organiser selection to all available options.
    const clearOrganiserSelection = () => {
        setTempOrganisers([...organiserOptions]);
        setSelectedOrganisers([...organiserOptions]);
        setIsOrganiserOpen(false);
    };

    // Determine if all genres are currently selected in the temp filter state.
    const isAllTempGenresSelected = tempGenres.length === genreOptions.length;

    // Generate label for genre filter button based on current selection.
    const getGenreLabel = () => {
        if (selectedGenres.length === genreOptions.length) {
            return 'All Genres';
        }

        if (selectedGenres.length === 0) {
            return 'All Genres';
        }

        if (selectedGenres.length === 1) {
            return selectedGenres[0];
        }

        return `${selectedGenres.length} Genres`;
    };

    // Toggle genre selection; "All Genres" acts as select-all/select-none.
    const toggleGenreOption = (option) => {
        // "All Genres" mirrors organiser select-all behavior.
        if (option === 'All Genres') {
            setTempGenres(isAllTempGenresSelected ? [] : [...genreOptions]);
            return;
        }

        setTempGenres((prev) =>
            prev.includes(option)
                ? prev.filter((item) => item !== option)
                : [...prev, option]
        );
    };

    // Commit temp genre selections to permanent filter state.
    const applyGenreSelection = () => {
        setSelectedGenres([...tempGenres]);
        setIsGenreOpen(false);
    };

    // Reset genre selection to all available options.
    const clearGenreSelection = () => {
        setTempGenres([...genreOptions]);
        setSelectedGenres([...genreOptions]);
        setIsGenreOpen(false);
    };

    // Commit temp music format selection to permanent filter state.
    const applyMusicFormatSelection = () => {
        setSelectedMusicFormat(tempMusicFormat);
        setIsMusicFormatOpen(false);
    };

    // Reset music format selection to "Both".
    const clearMusicFormatSelection = () => {
        setTempMusicFormat('Both');
        setSelectedMusicFormat('Both');
        setIsMusicFormatOpen(false);
    };

    // Clear all active filters and reset to default state.
    const clearAllFilters = () => {
        setSelectedCategory('All');

        setTempDateStart('');
        setTempDateEnd('');
        setSelectedDateStart('');
        setSelectedDateEnd('');

        setTempOrganisers([...organiserOptions]);
        setSelectedOrganisers([...organiserOptions]);

        setTempGenres([...genreOptions]);
        setSelectedGenres([...genreOptions]);

        setTempMusicFormat('Both');
        setSelectedMusicFormat('Both');

        setLocationQuery('');
        setLocationSuggestions([]);
        setLocationError('');
        setIsLocationFilterActive(false);

        closeAllDropdowns();
    };

    // Handle "Add Event" button: redirect to create page if organiser, else show contact form.
    const handleAddEventClick = () => {
        if (canCreateEvent) {
            navigate('/dashboard/calendar/create');
            return;
        }

        // Show contact popup for non-organisers requesting organiser status.
        setContactMessage('');
        setAllowEmailContact(false);
        setAllowPhoneContact(false);
        setContactPopupError('');
        setIsSendingContactRequest(false);
        setIsContactRequestSubmitted(false);
        setIsContactPopupOpen(true);
    };

    // Update contact message and validate word count during input.
    const handleContactMessageChange = (event) => {
        const nextValue = event.target.value;
        setContactPopupError('');
        if (countWords(nextValue) <= CONTACT_MESSAGE_MAX_WORDS) {
            setContactMessage(nextValue);
        }
    };

    // Close the contact popup and reset form state.
    const closeContactPopup = () => {
        setIsContactPopupOpen(false);
        setContactPopupError('');
        setIsSendingContactRequest(false);
        setIsContactRequestSubmitted(false);
    };

    // Submit organiser verification request with message and contact preference.
    const handleContactRequestSubmit = async () => {
        if (isSendingContactRequest) return;

        const normalizedMessage = typeof contactMessage === 'string' ? contactMessage.trim() : '';

        // Validate form before submission.
        if (!normalizedMessage) {
            setContactPopupError('Please provide a message before sending your request.');
            return;
        }

        if (!allowEmailContact && !allowPhoneContact) {
            setContactPopupError('Choose at least one contact method.');
            return;
        }

        if (allowPhoneContact && !String(user?.phoneNumber || '').trim()) {
            setContactPopupError("You haven't provided your phone number. Please add your phone number on your profile edit or select Email");
            return;
        }

        setContactPopupError('');
        setIsSendingContactRequest(true);

        try {
            const response = await fetch(`${API_URL}/api/calendar/organiser-verification-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    message: normalizedMessage,
                    allowEmailContact,
                    allowPhoneContact,
                }),
            });

            let data = {};
            try {
                data = await response.json();
            } catch {
                data = {};
            }

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to send organiser verification request.');
            }

            setContactPopupError('');
            setIsSendingContactRequest(false);
            setIsContactRequestSubmitted(true);
        } catch (error) {
            setContactPopupError(error.message || 'Unable to send organiser verification request.');
            setIsSendingContactRequest(false);
        }
    };

    // Calculate current word count for contact message display.
    const contactMessageWordCount = countWords(contactMessage);

    return (
        <div className="calendar-page">
            <h1 className="calendar-title">Calendar</h1>

            {/* Category Filter with Icons: allows users to filter by event type */}
            <div className="category-filter-vertical">
                {categories.map((category) => (
                    <button
                        key={category}
                        className={`category-card ${selectedCategory === category ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(category)}
                    >
                        <div className="category-icon-wrapper">
                            <img src={categoryIcons[category]} alt={category} className="category-icon" />
                        </div>
                        <span className="category-label">{category}</span>
                    </button>
                ))}
            </div>

            {/* Filter Row: Location + Filter Controls (Date, Organiser, Genre, Music Format) */}
            <div className="filter-row">
                {/* Location Filter: Geolocation-based city detection with autocomplete dropdown */}
                <div className="location-dropdown" ref={locationDropdownRef}>
                    <button
                        className={`location-filter-inline location-dropdown-trigger ${isLocationOpen ? 'open' : ''}`}
                        type="button"
                        onClick={() => toggleDropdown('location')}
                    >
                        <MapPin />
                        <span>{location}</span>
                        <span className="location-dropdown-caret">▾</span>
                    </button>

                    {isLocationOpen ? (
                        <div className="location-dropdown-panel" role="dialog" aria-label="Select city">
                            <input
                                type="text"
                                className="location-dropdown-input"
                                value={locationQuery}
                                onChange={(event) => setLocationQuery(event.target.value)}
                                placeholder="Search city"
                                autoFocus
                            />

                            {isLocationLoading ? <small className="location-dropdown-hint">Searching cities...</small> : null}
                            {locationError ? <small className="location-dropdown-error">{locationError}</small> : null}

                            <div className="location-dropdown-options" role="listbox">
                                {locationSuggestions.map((suggestion) => (
                                    <button
                                        key={suggestion.id}
                                        type="button"
                                        className="location-dropdown-option"
                                        role="option"
                                        onMouseDown={(mouseEvent) => {
                                            mouseEvent.preventDefault();
                                            const nextCity = String(suggestion.city || '').trim();
                                            if (nextCity) {
                                                setLocation(nextCity);
                                                setIsLocationFilterActive(true);
                                            }
                                            setLocationQuery(nextCity);
                                            closeAllDropdowns();
                                        }}
                                    >
                                        <span>{suggestion.description}</span>
                                    </button>
                                ))}
                                {!isLocationLoading && !locationError && locationQuery.trim().length > 0 && locationSuggestions.length === 0 ? (
                                    <div className="location-dropdown-empty">No cities found.</div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Filter Controls: Date range, Organiser, Genre, Music Format, and Clear All button */}
                <div className="filter-controls" ref={filterControlsRef}>
                    {/* Date Filter: Select start and end dates for event display */}
                    <div className="date-dropdown" ref={dateDropdownRef}>
                        <button
                            className={`date-dropdown-trigger ${isDateOpen ? 'open' : ''}`}
                            type="button"
                            onClick={() => toggleDropdown('date')}
                        >
                            <span>{getDateRangeLabel()}</span>
                            <span className="date-dropdown-caret">▾</span>
                        </button>

                        {isDateOpen && (
                            <div className="date-dropdown-panel">
                                <label className="date-dropdown-label" htmlFor="calendar-date-start-input">
                                    Start Date
                                </label>
                                <input
                                    id="calendar-date-start-input"
                                    className="date-dropdown-input"
                                    type="date"
                                    value={tempDateStart}
                                    max={tempDateEnd || undefined}
                                    onChange={(e) => setTempDateStart(e.target.value)}
                                />

                                <label className="date-dropdown-label" htmlFor="calendar-date-end-input">
                                    End Date
                                </label>
                                <input
                                    id="calendar-date-end-input"
                                    className="date-dropdown-input"
                                    type="date"
                                    value={tempDateEnd}
                                    min={tempDateStart || undefined}
                                    onChange={(e) => setTempDateEnd(e.target.value)}
                                />

                                <div className="date-dropdown-actions">
                                    <button
                                        className="date-dropdown-apply"
                                        type="button"
                                        onClick={applyDateSelection}
                                    >
                                        Apply
                                    </button>
                                    <button
                                        className="date-dropdown-clear"
                                        type="button"
                                        onClick={clearDateSelection}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Organiser Filter: Multi-select dropdown with select-all option */}
                    <div className="organiser-dropdown" ref={organiserDropdownRef}>
                        <button
                            className={`organiser-dropdown-trigger ${isOrganiserOpen ? 'open' : ''}`}
                            type="button"
                            onClick={() => toggleDropdown('organiser')}
                        >
                            <span>{getOrganiserLabel()}</span>
                            <span className="organiser-dropdown-caret">▾</span>
                        </button>

                        {isOrganiserOpen && (
                            <div className="organiser-dropdown-panel">
                                <div className="organiser-dropdown-options">
                                    {['All Organisers', ...organiserOptions].map((option) => {
                                        const isChecked = option === 'All Organisers'
                                            ? isAllTempSelected
                                            : tempOrganisers.includes(option);

                                        return (
                                            <label
                                                key={option}
                                                className={`organiser-option ${isChecked ? 'active' : ''}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleOrganiserOption(option)}
                                                />
                                                <span>{option}</span>
                                            </label>
                                        );
                                    })}
                                </div>

                                <div className="organiser-dropdown-actions">
                                    <button
                                        className="organiser-dropdown-apply"
                                        type="button"
                                        onClick={applyOrganiserSelection}
                                    >
                                        Apply
                                    </button>
                                    <button
                                        className="organiser-dropdown-clear"
                                        type="button"
                                        onClick={clearOrganiserSelection}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Genre Filter: Multi-select dropdown with select-all option */}
                    <div className="genre-dropdown" ref={genreDropdownRef}>
                        <button
                            className={`genre-dropdown-trigger ${isGenreOpen ? 'open' : ''}`}
                            type="button"
                            onClick={() => toggleDropdown('genre')}
                        >
                            <span>{getGenreLabel()}</span>
                            <span className="genre-dropdown-caret">▾</span>
                        </button>

                        {isGenreOpen && (
                            <div className="genre-dropdown-panel">
                                <div className="genre-dropdown-options">
                                    {['All Genres', ...genreOptions].map((option) => {
                                        const isChecked = option === 'All Genres'
                                            ? isAllTempGenresSelected
                                            : tempGenres.includes(option);

                                        return (
                                            <label
                                                key={option}
                                                className={`genre-option ${isChecked ? 'active' : ''}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleGenreOption(option)}
                                                />
                                                <span>{option}</span>
                                            </label>
                                        );
                                    })}
                                </div>

                                <div className="genre-dropdown-actions">
                                    <button
                                        className="genre-dropdown-apply"
                                        type="button"
                                        onClick={applyGenreSelection}
                                    >
                                        Apply
                                    </button>
                                    <button
                                        className="genre-dropdown-clear"
                                        type="button"
                                        onClick={clearGenreSelection}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Music Format Filter: Radio-button single-select dropdown */}
                    <div className="music-format-dropdown" ref={musicFormatDropdownRef}>
                        <button
                            className={`music-format-dropdown-trigger ${isMusicFormatOpen ? 'open' : ''}`}
                            type="button"
                            onClick={() => toggleDropdown('musicFormat')}
                        >
                            <span>{selectedMusicFormat}</span>
                            <span className="music-format-dropdown-caret">▾</span>
                        </button>

                        {isMusicFormatOpen && (
                            <div className="music-format-dropdown-panel">
                                <div className="music-format-dropdown-options">
                                    {musicFormatOptions.map((option) => (
                                        <label
                                            key={option}
                                            className={`music-format-option ${tempMusicFormat === option ? 'active' : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="music-format"
                                                checked={tempMusicFormat === option}
                                                onChange={() => setTempMusicFormat(option)}
                                            />
                                            <span>{option}</span>
                                        </label>
                                    ))}
                                </div>

                                <div className="music-format-dropdown-actions">
                                    <button
                                        className="music-format-dropdown-apply"
                                        type="button"
                                        onClick={applyMusicFormatSelection}
                                    >
                                        Apply
                                    </button>
                                    <button
                                        className="music-format-dropdown-clear"
                                        type="button"
                                        onClick={clearMusicFormatSelection}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Clear Filters Button: Reset all active filters to default state */}
                    <button className="btn-apply-filters" type="button" onClick={clearAllFilters}>Clear Filters</button>
                </div>
            </div>

            {/* Add Event Button: Navigate to create page for organisers, show contact form for others */}
            <button className="btn-add-event" type="button" onClick={handleAddEventClick}>
                <Plus />
                <span>Add Event</span>
            </button>

            {/* Events Display Section: Shows loading, errors, or filtered event list */}
            {isLoadingEvents ? <p>Loading events...</p> : null}
            {!isLoadingEvents && eventsError ? <p>{eventsError}</p> : null}
            {!isLoadingEvents && !eventsError ? (
                <>
                    {/* Upcoming Events Section */}
                    <section className="events-section" aria-label="Upcoming events">
                        <h2 className="events-section-title">Upcoming</h2>
                        {upcomingEvents.length === 0 ? <p className="events-empty-note">No upcoming events for the selected filters.</p> : null}
                        <div className="events-grid">
                            {upcomingEvents.map((event) => (
                                <CalendarEventCard
                                    key={`upcoming-${event.id}`}
                                    event={event}
                                    canEditEvent={event.isEditable}
                                    canDeleteEvent={Boolean(event.isDeletable)}
                                    onEdit={handleEditEvent}
                                    onDelete={requestDeleteEvent}
                                    onView={handleViewEvent}
                                    onOrganizerClick={handleOrganizerProfileClick}
                                    isDeleting={deletingEventId === event.id}
                                    onGoing={handleMarkGoing}
                                    onAttendeesClick={openAttendeesPopup}
                                    isGoingPending={goingEventIds.includes(event.id)}
                                    canMarkGoing={canMarkGoing}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Past Events Section */}
                    <section className="events-section" aria-label="Past events">
                        <h2 className="events-section-title">Past events</h2>
                        {pastEvents.length === 0 ? <p className="events-empty-note">No past events for the selected filters.</p> : null}
                        <div className="events-grid">
                            {pastEvents.map((event) => (
                                <CalendarEventCard
                                    key={`past-${event.id}`}
                                    event={event}
                                    canEditEvent={event.isEditable}
                                    canDeleteEvent={Boolean(event.isDeletable)}
                                    onEdit={handleEditEvent}
                                    onDelete={requestDeleteEvent}
                                    onView={handleViewEvent}
                                    onOrganizerClick={handleOrganizerProfileClick}
                                    isDeleting={deletingEventId === event.id}
                                    onGoing={handleMarkGoing}
                                    onAttendeesClick={openAttendeesPopup}
                                    isGoingPending={goingEventIds.includes(event.id)}
                                    canMarkGoing={canMarkGoing}
                                />
                            ))}
                        </div>
                    </section>
                </>
            ) : null}

            {/* Attendees Popup: Displays list of attendees for a specific event */}
            <AttendeesPopup
                isOpen={Boolean(attendeesPopupEvent)}
                onClose={closeAttendeesPopup}
                onViewProfile={handleOrganizerProfileClick}
                attendees={attendeesPopupEvent?.attendees || []}
                titlePrefix="People going to"
                highlightedTitle={attendeesPopupEvent?.title || 'this event'}
            />

            {/* Contact Form Popup: Shown to non-organisers requesting organiser status */}
            {isContactPopupOpen ? (
                <div className="contact-popup-overlay" role="presentation" onClick={closeContactPopup}>
                    <div
                        className="contact-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="contact-popup-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button className="contact-popup-close" type="button" onClick={closeContactPopup} aria-label="Close">
                            x
                        </button>

                        {isContactRequestSubmitted ? (
                            // Success message after form submission
                            <div className="contact-popup-confirmation">
                                <h2 id="contact-popup-title" className="contact-popup-title contact-popup-success-title">
                                    Request sent successfully
                                </h2>
                                <p className="contact-popup-description contact-popup-success-description">
                                    Thank you. Your organiser verification request has been sent to the Swinggity team. We will review your message and contact you using the selected details.
                                </p>
                                <div className="contact-popup-actions contact-popup-success-actions">
                                    <button type="button" className="contact-popup-submit" onClick={closeContactPopup}>
                                        Close
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // Contact form before submission
                            <>
                                <h2 id="contact-popup-title" className="contact-popup-title">
                                    You need to be a <span>verified organiser</span> to post on the calendar
                                </h2>

                                <p className="contact-popup-description">
                                    If you are an event organiser or teacher please contact us and we will verify your status. If successful, you will be able to post events freely.
                                </p>

                                <hr className="contact-popup-divider" />

                                <label className="contact-popup-label" htmlFor="organiser-contact-message">
                                    Your message <small>(max 200 words)</small>
                                </label>
                                <textarea
                                    id="organiser-contact-message"
                                    className="contact-popup-textarea"
                                    value={contactMessage}
                                    onChange={handleContactMessageChange}
                                    placeholder=""
                                />
                                <p className="contact-popup-count">{contactMessageWordCount} / {CONTACT_MESSAGE_MAX_WORDS} words</p>

                                <h3 className="contact-popup-contact-title">How can we contact you?</h3>
                                <p className="contact-popup-contact-description">
                                    Choose at least one option. Your details will only be shared with the Swinggity administration.
                                </p>

                                <div className="contact-popup-checkbox-row">
                                    <label className="contact-popup-checkbox-item">
                                        <input
                                            type="checkbox"
                                            checked={allowEmailContact}
                                            onChange={(event) => {
                                                setAllowEmailContact(event.target.checked);
                                                setContactPopupError('');
                                            }}
                                        />
                                        <span>Email</span>
                                    </label>

                                    <label className="contact-popup-checkbox-item">
                                        <input
                                            type="checkbox"
                                            checked={allowPhoneContact}
                                            onChange={(event) => {
                                                setAllowPhoneContact(event.target.checked);
                                                setContactPopupError('');
                                            }}
                                        />
                                        <span>Phone Number</span>
                                    </label>
                                </div>

                                <p className="contact-popup-note">
                                    <strong>Note:</strong> as part of our verification process, you may need to send us messages through your social media or websites.
                                </p>

                                {contactPopupError ? <p className="contact-popup-error">{contactPopupError}</p> : null}

                                <div className="contact-popup-actions">
                                    <button
                                        type="button"
                                        className="contact-popup-submit"
                                        onClick={handleContactRequestSubmit}
                                        disabled={isSendingContactRequest}
                                    >
                                        {isSendingContactRequest ? 'Sending...' : 'Send request'}
                                    </button>
                                    <button type="button" className="contact-popup-cancel" onClick={closeContactPopup}>
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : null}

            {/* Delete Confirmation Popup: Shown when user attempts to delete an event */}
            {isDeletePopupOpen ? (
                <div className="contact-popup-overlay" role="presentation" onClick={closeDeletePopup}>
                    <div
                        className="contact-popup delete-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-popup-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="delete-popup-title" className="delete-popup-title">
                            Are you sure you want to delete this event? This Action can not be undone
                        </h2>

                        <div className="delete-popup-actions">
                            <button
                                type="button"
                                className="delete-popup-confirm"
                                onClick={confirmDeleteEvent}
                                disabled={Boolean(deletingEventId)}
                            >
                                {deletingEventId ? 'Deleting...' : 'Delete Event'}
                            </button>
                            <button
                                type="button"
                                className="delete-popup-cancel"
                                onClick={closeDeletePopup}
                                disabled={Boolean(deletingEventId)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
