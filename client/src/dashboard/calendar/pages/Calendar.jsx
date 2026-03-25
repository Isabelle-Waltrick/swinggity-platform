import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

// Placeholder event images
const SWINGGITY2 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 196 40'%3E%3Ctext x='10' y='30' font-size='24' font-family='Arial' font-weight='bold' fill='%23FF6699'%3ESWINGGITY%3C/text%3E%3C/svg%3E";
const SWINGGITY5 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 196 40'%3E%3Ctext x='10' y='30' font-size='24' font-family='Arial' font-weight='bold' fill='%23FF6699'%3ESWINGGITY%3C/text%3E%3C/svg%3E";
const dalstonCover2 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 324 168'%3E%3Crect fill='%23FFE2F3' width='324' height='168'/%3E%3Ctext x='50%25' y='50%25' font-size='20' font-family='Arial' fill='%23FF6699' text-anchor='middle' dominant-baseline='middle'%3EDalston%3C/text%3E%3C/svg%3E";
const limehouseCover1 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 324 168'%3E%3Crect fill='%23FFE2F3' width='324' height='168'/%3E%3Ctext x='50%25' y='50%25' font-size='20' font-family='Arial' fill='%23FF6699' text-anchor='middle' dominant-baseline='middle'%3ELimehouse%3C/text%3E%3C/svg%3E";

// Event Card Component
const EventCard = ({ event, isEditable = false }) => {
    const { date, organizer, title, attendees, image } = event;

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
                            <button className="btn-delete">
                                <RecycleBin />
                                <span>Delete</span>
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
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [location] = useState('London');
    const filterControlsRef = useRef(null);

    // Each filter uses "temp" state inside the open panel and commits to "selected" state on Apply.
    // This prevents half-finished choices from changing the visible filter chips immediately.
    const [isDateOpen, setIsDateOpen] = useState(false);
    const [tempDate, setTempDate] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [isOrganiserOpen, setIsOrganiserOpen] = useState(false);
    const organiserOptions = ['Swinggity', 'Dalston Does', 'Limehouse Town Hall'];
    const [tempOrganisers, setTempOrganisers] = useState([...organiserOptions]);
    const [selectedOrganisers, setSelectedOrganisers] = useState([...organiserOptions]);
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

    const events = [
        {
            date: 'Fri, 12 Dec at 19:30',
            organizer: '7:30 Special',
            title: '7:30 Festive Specials x North London Jazz Collective',
            attendees: 20,
            image: SWINGGITY2,
            isPast: false
        },
        {
            date: 'Sat, 20 Dec at 19:00',
            organizer: 'Dalston Does',
            title: "Pete Long's Pocket Basie play Dalston Does Highbury Xmas Special",
            attendees: 35,
            image: dalstonCover2,
            isPast: false
        },
        {
            date: 'Fri, 12 Dec at 19:30',
            organizer: 'Limehouse Town Hall',
            title: '7:30 Festive Specials x North London Jazz Collective',
            attendees: 20,
            image: limehouseCover1,
            isEditable: true,
            isPast: false
        }
    ];

    const categories = ['All', 'Socials', 'Classes', 'Workshops', 'Festivals'];

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
                {/* Static sample data for now; can be swapped with API-backed events later. */}
                {events.map((event, index) => (
                    <EventCard
                        key={index}
                        event={event}
                        isEditable={event.isEditable}
                    />
                ))}
            </div>
        </div>
    );
}
