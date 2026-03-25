import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import { CheckCircle } from "../components/CheckCircle";
import { MapPin } from "../components/MapPin";
import { Plus } from "../components/Plus";
import { RecycleBin } from "../components/RecycleBin";
import "../styles/Calendar.css";

// Category icons
import allIcon from "../../../assets/All-Not-Selected.svg";
import socialsIcon from "../../../assets/Socials-Not-Selected.svg";
import classesIcon from "../../../assets/Classes-Not-Selected.svg";
import workshopsIcon from "../../../assets/workshops-not-selected.svg";
import festivalsIcon from "../../../assets/Festivals_Not_Selected.svg";
import editSquaredIcon from "../../../assets/edit-squared.svg";

// Placeholder event image
const limehouseCover1 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 324 168'%3E%3Crect fill='%23FFE2F3' width='324' height='168'/%3E%3Ctext x='50%25' y='50%25' font-size='20' font-family='Arial' fill='%23FF6699' text-anchor='middle' dominant-baseline='middle'%3ELimehouse%3C/text%3E%3C/svg%3E";

const FALLBACK_EVENT_IMAGE = limehouseCover1;

const CATEGORY_TO_EVENT_TYPE = {
    Socials: 'Social',
    Classes: 'Class',
    Workshops: 'Workshop',
    Festivals: 'Festival',
};

const formatEventDateLabel = (startDate, startTime) => {
    const normalizedDate = typeof startDate === 'string' ? startDate.trim() : '';
    const normalizedTime = typeof startTime === 'string' ? startTime.trim() : '';
    if (!normalizedDate) return '';

    const date = new Date(`${normalizedDate}T${normalizedTime || '00:00'}`);
    if (Number.isNaN(date.getTime())) return normalizedDate;

    const datePart = date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
    });

    if (!normalizedTime) return datePart;
    return `${datePart} at ${normalizedTime}`;
};

// Event Card Component
const EventCard = ({ event, isEditable = false, onDelete, isDeleting = false }) => {
    const { date, organizer, title, attendees, image, id } = event;

    return (
        <div className="event-card">
            <div className="event-image-wrapper">
                <img src={image} alt="Event" className="event-image" />
            </div>

            <div className="event-content">
                <p className="event-date">{date}</p>

                <p className="event-organizer">
                    <span>by </span>
                    <span className="organizer-name">{organizer}</span>
                </p>

                <p className="event-title">{title}</p>

                <div className="event-attendees">
                    <div className="attendees-text">{attendees} attendees</div>
                    <div className="avatar-stack">
                        <div className="avatar" style={{ backgroundColor: "#d9d9d9" }}></div>
                        <div className="avatar" style={{ backgroundColor: "#000000" }}></div>
                        <div className="avatar" style={{ backgroundColor: "#5d5d5d" }}></div>
                    </div>
                </div>

                <div className="event-actions">
                    {!isEditable ? (
                        <>
                            <button className="btn-going">
                                <CheckCircle />
                                <span>Going</span>
                            </button>
                            <a href="#" className="link-view-event">View event</a>
                        </>
                    ) : (
                        <>
                            <a href="#" className="link-view-event">View event</a>
                            <button className="btn-edit">
                                <img src={editSquaredIcon} alt="" className="btn-edit-icon" />
                                <span>Edit</span>
                            </button>
                            <button className="btn-delete" onClick={() => onDelete?.(id)} disabled={isDeleting}>
                                <RecycleBin />
                                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function CalendarPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [location] = useState('London');
    const [events, setEvents] = useState([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(true);
    const [eventsError, setEventsError] = useState('');
    const [deletingEventId, setDeletingEventId] = useState('');
    const filterControlsRef = useRef(null);

    // Each filter uses "temp" state inside the open panel and commits to "selected" state on Apply.
    // This prevents half-finished choices from changing the visible filter chips immediately.
    const [isDateOpen, setIsDateOpen] = useState(false);
    const [tempDate, setTempDate] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [isOrganiserOpen, setIsOrganiserOpen] = useState(false);
    const [tempOrganisers, setTempOrganisers] = useState([]);
    const [selectedOrganisers, setSelectedOrganisers] = useState([]);
    const [isGenreOpen, setIsGenreOpen] = useState(false);
    const genreOptions = ['Lindy Hop', 'Collegiate Shag', 'Balboa', 'Jive', 'Boogie Woogie', 'West/East Coast'];
    const [tempGenres, setTempGenres] = useState([...genreOptions]);
    const [selectedGenres, setSelectedGenres] = useState([...genreOptions]);
    const [isMusicFormatOpen, setIsMusicFormatOpen] = useState(false);
    const musicFormatOptions = ['All', 'DJ', 'Live music'];
    const [tempMusicFormat, setTempMusicFormat] = useState('All');
    const [selectedMusicFormat, setSelectedMusicFormat] = useState('All');

    // Keep only one dropdown open at a time for a cleaner, predictable interaction pattern.
    const closeAllDropdowns = () => {
        setIsDateOpen(false);
        setIsOrganiserOpen(false);
        setIsGenreOpen(false);
        setIsMusicFormatOpen(false);
    };

    const toggleDropdown = (dropdown) => {
        const wasOpen = {
            date: isDateOpen,
            organiser: isOrganiserOpen,
            genre: isGenreOpen,
            musicFormat: isMusicFormatOpen
        }[dropdown];

        closeAllDropdowns();

        if (!wasOpen) {
            if (dropdown === 'date') setIsDateOpen(true);
            if (dropdown === 'organiser') setIsOrganiserOpen(true);
            if (dropdown === 'genre') setIsGenreOpen(true);
            if (dropdown === 'musicFormat') setIsMusicFormatOpen(true);
        }
    };

    useEffect(() => {
        const handleDocumentMouseDown = (event) => {
            const hasOpenDropdown = isDateOpen || isOrganiserOpen || isGenreOpen || isMusicFormatOpen;
            if (!hasOpenDropdown) return;

            if (filterControlsRef.current && !filterControlsRef.current.contains(event.target)) {
                closeAllDropdowns();
            }
        };

        document.addEventListener('mousedown', handleDocumentMouseDown);
        return () => {
            document.removeEventListener('mousedown', handleDocumentMouseDown);
        };
    }, [isDateOpen, isOrganiserOpen, isGenreOpen, isMusicFormatOpen]);

    const categoryIcons = {
        'All': allIcon,
        'Socials': socialsIcon,
        'Classes': classesIcon,
        'Workshops': workshopsIcon,
        'Festivals': festivalsIcon
    };

    useEffect(() => {
        const fetchCalendarEvents = async () => {
            setIsLoadingEvents(true);
            setEventsError('');
            try {
                const response = await fetch(`${API_URL}/api/calendar/events`, {
                    credentials: 'include',
                });
                const data = await response.json();

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
    }, [API_URL]);

    const organiserOptions = useMemo(() => ([...new Set(
        events
            .map((event) => String(event.organizerName || '').trim())
            .filter(Boolean)
    )]), [events]);

    useEffect(() => {
        if (organiserOptions.length === 0) {
            setTempOrganisers([]);
            setSelectedOrganisers([]);
            return;
        }

        setTempOrganisers((previous) => {
            if (previous.length === 0) return [...organiserOptions];
            const kept = previous.filter((item) => organiserOptions.includes(item));
            return kept.length === 0 ? [...organiserOptions] : kept;
        });

        setSelectedOrganisers((previous) => {
            if (previous.length === 0) return [...organiserOptions];
            const kept = previous.filter((item) => organiserOptions.includes(item));
            return kept.length === 0 ? [...organiserOptions] : kept;
        });
    }, [organiserOptions]);

    const handleDeleteEvent = async (eventId) => {
        if (!eventId || deletingEventId) return;

        setDeletingEventId(eventId);
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

            setEvents((current) => current.filter((item) => String(item.id || '') !== String(eventId)));
        } catch (error) {
            setEventsError(error.message || 'Unable to delete event.');
        } finally {
            setDeletingEventId('');
        }
    };

    const categories = ['All', 'Socials', 'Classes', 'Workshops', 'Festivals'];

    const visibleEvents = events
        .filter((event) => {
            if (selectedCategory === 'All') return true;
            return event.eventType === CATEGORY_TO_EVENT_TYPE[selectedCategory];
        })
        .filter((event) => {
            if (!selectedDate) return true;
            return String(event.startDate || '') === selectedDate;
        })
        .filter((event) => {
            if (selectedMusicFormat === 'All') return true;
            return String(event.musicFormat || '') === selectedMusicFormat;
        })
        .filter((event) => {
            if (selectedOrganisers.length === organiserOptions.length) return true;
            if (selectedOrganisers.length === 0) return true;
            return selectedOrganisers.includes(String(event.organizerName || ''));
        })
        .filter((event) => {
            if (selectedGenres.length === genreOptions.length) return true;
            if (selectedGenres.length === 0) return true;

            const eventGenres = Array.isArray(event.genres) ? event.genres : [];
            return eventGenres.some((genre) => selectedGenres.includes(genre));
        })
        .map((event) => ({
            ...event,
            date: formatEventDateLabel(event.startDate, event.startTime),
            organizer: event.organizerName,
            attendees: Number.isFinite(event.attendeesCount) ? event.attendeesCount : 0,
            image: event.imageUrl ? (event.imageUrl.startsWith('http') ? event.imageUrl : `${API_URL}${event.imageUrl}`) : FALLBACK_EVENT_IMAGE,
            isEditable: user?.role === 'admin' || String(event.createdById || '') === String(user?._id || ''),
        }));

    const formatDateLabel = (value) => {
        // Date input returns YYYY-MM-DD; format it for the UI trigger label.
        if (!value) {
            return 'Date';
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return 'Date';
        }

        return parsed.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const applyDateSelection = () => {
        setSelectedDate(tempDate);
        setIsDateOpen(false);
    };

    const clearDateSelection = () => {
        setTempDate('');
        setSelectedDate('');
        setIsDateOpen(false);
    };

    const isAllTempSelected = tempOrganisers.length === organiserOptions.length;

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

    const applyOrganiserSelection = () => {
        setSelectedOrganisers([...tempOrganisers]);
        setIsOrganiserOpen(false);
    };

    const clearOrganiserSelection = () => {
        setTempOrganisers([...organiserOptions]);
        setSelectedOrganisers([...organiserOptions]);
        setIsOrganiserOpen(false);
    };

    const isAllTempGenresSelected = tempGenres.length === genreOptions.length;

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

    const applyGenreSelection = () => {
        setSelectedGenres([...tempGenres]);
        setIsGenreOpen(false);
    };

    const clearGenreSelection = () => {
        setTempGenres([...genreOptions]);
        setSelectedGenres([...genreOptions]);
        setIsGenreOpen(false);
    };

    const applyMusicFormatSelection = () => {
        setSelectedMusicFormat(tempMusicFormat);
        setIsMusicFormatOpen(false);
    };

    const clearMusicFormatSelection = () => {
        setTempMusicFormat('All');
        setSelectedMusicFormat('All');
        setIsMusicFormatOpen(false);
    };

    return (
        <div className="calendar-page">
            <h1 className="calendar-title">Calendar</h1>

            {/* Category Filter with Icons */}
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

            {/* Filter Row: Location + Filter Controls */}
            <div className="filter-row">
                {/* Location Filter */}
                <div className="location-filter-inline">
                    <MapPin />
                    <span>{location}</span>
                </div>

                {/* Filter Controls */}
                <div className="filter-controls" ref={filterControlsRef}>
                    <div className="date-dropdown">
                        <button
                            className={`date-dropdown-trigger ${isDateOpen ? 'open' : ''}`}
                            type="button"
                            onClick={() => toggleDropdown('date')}
                        >
                            <span>{formatDateLabel(selectedDate)}</span>
                            <span className="date-dropdown-caret">▾</span>
                        </button>

                        {isDateOpen && (
                            <div className="date-dropdown-panel">
                                <label className="date-dropdown-label" htmlFor="calendar-date-input">
                                    Select Date
                                </label>
                                <input
                                    id="calendar-date-input"
                                    className="date-dropdown-input"
                                    type="date"
                                    value={tempDate}
                                    onChange={(e) => setTempDate(e.target.value)}
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
                    <div className="organiser-dropdown">
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
                    <div className="genre-dropdown">
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
                    <div className="music-format-dropdown">
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
                    <button className="btn-apply-filters">Apply Filters</button>
                </div>
            </div>

            {/* Add Event Button */}
            <button className="btn-add-event" type="button" onClick={() => navigate('/dashboard/calendar/create')}>
                <Plus />
                <span>Add Event</span>
            </button>

            {/* Events Grid */}
            <div className="events-grid">
                {isLoadingEvents ? <p>Loading events...</p> : null}
                {!isLoadingEvents && eventsError ? <p>{eventsError}</p> : null}
                {!isLoadingEvents && !eventsError && visibleEvents.length === 0 ? <p>No events found for selected filters.</p> : null}
                {!isLoadingEvents && !eventsError && visibleEvents.map((event) => (
                    <EventCard
                        key={event.id}
                        event={event}
                        isEditable={event.isEditable}
                        onDelete={handleDeleteEvent}
                        isDeleting={deletingEventId === event.id}
                    />
                ))}
            </div>
        </div>
    );
}
