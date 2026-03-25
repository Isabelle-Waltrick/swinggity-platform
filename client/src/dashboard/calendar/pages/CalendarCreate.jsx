import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import '../styles/CalendarCreate.css';

const EVENT_TYPES = ['Social', 'Class', 'Workshop', 'Festival'];
const CURRENCIES = ['GBP', 'EUR', 'USD'];
const RESALE_OPTIONS = ['When tickets are sold-out', 'Always'];
const GENRE_OPTIONS = ['Lindy Hop', 'Collegiate Shag', 'Balboa', 'Jive', 'Boogie Woogie', 'West/East Coast'];
const MUSIC_FORMAT_OPTIONS = ['All', 'DJ', 'Live music'];

const getHostName = (user) => {
    if (!user) return 'Main host';

    const first = user.displayFirstName || user.firstName || '';
    const last = user.displayLastName || user.lastName || '';
    const fullName = `${first} ${last}`.trim();

    return fullName || user.email || 'Main host';
};

const initialFormState = {
    eventType: 'Social',
    title: '',
    description: '',
    genres: [...GENRE_OPTIONS],
    musicFormat: 'All',
    startDate: '',
    startTime: '',
    endTime: '',
    venue: '',
    address: '',
    onlineEvent: false,
    ticketType: 'prepaid',
    freeEvent: false,
    minPrice: '',
    maxPrice: '',
    fixedPrice: false,
    currency: 'GBP',
    ticketLink: '',
    allowResell: 'yes',
    resellCondition: 'When tickets are sold-out',
    instagram: '',
    facebook: '',
    youtube: '',
    linkedin: '',
    website: '',
    coHosts: ''
};

export default function CalendarCreatePage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [form, setForm] = useState(initialFormState);
    const [eventImage, setEventImage] = useState(null);
    const [isGenreOpen, setIsGenreOpen] = useState(false);
    const [isMusicFormatOpen, setIsMusicFormatOpen] = useState(false);
    const detailsFiltersRef = useRef(null);

    const descriptionCount = form.description.length;
    const hostName = useMemo(() => getHostName(user), [user]);
    const isAllGenresSelected = form.genres.length === GENRE_OPTIONS.length;

    useEffect(() => {
        const handleDocumentMouseDown = (event) => {
            const hasOpenDropdown = isGenreOpen || isMusicFormatOpen;
            if (!hasOpenDropdown) return;

            if (detailsFiltersRef.current && !detailsFiltersRef.current.contains(event.target)) {
                setIsGenreOpen(false);
                setIsMusicFormatOpen(false);
            }
        };

        document.addEventListener('mousedown', handleDocumentMouseDown);
        return () => {
            document.removeEventListener('mousedown', handleDocumentMouseDown);
        };
    }, [isGenreOpen, isMusicFormatOpen]);

    const handleFieldChange = (event) => {
        const { name, value, type, checked } = event.target;

        if (name === 'fixedPrice') {
            setForm((prev) => ({
                ...prev,
                fixedPrice: checked,
                maxPrice: checked ? prev.minPrice : prev.maxPrice,
            }));
            return;
        }

        if (name === 'minPrice') {
            setForm((prev) => ({
                ...prev,
                minPrice: value,
                maxPrice: prev.fixedPrice ? value : prev.maxPrice,
            }));
            return;
        }

        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleTypeSelect = (type) => {
        setForm((prev) => ({ ...prev, eventType: type }));
    };

    const getGenreLabel = () => {
        if (form.genres.length === GENRE_OPTIONS.length || form.genres.length === 0) {
            return 'All Genres';
        }

        if (form.genres.length === 1) {
            return form.genres[0];
        }

        return `${form.genres.length} Genres`;
    };

    const toggleGenreOption = (option) => {
        setForm((prev) => {
            if (option === 'All Genres') {
                return {
                    ...prev,
                    genres: isAllGenresSelected ? [] : [...GENRE_OPTIONS],
                };
            }

            const hasOption = prev.genres.includes(option);
            return {
                ...prev,
                genres: hasOption
                    ? prev.genres.filter((item) => item !== option)
                    : [...prev.genres, option],
            };
        });
    };

    const handleMusicFormatSelect = (option) => {
        setForm((prev) => ({ ...prev, musicFormat: option }));
        setIsMusicFormatOpen(false);
    };

    const handleImageChange = (event) => {
        const file = event.target.files?.[0] || null;
        setEventImage(file);
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        // Placeholder submit until API endpoint is ready.
        console.log('Create event payload', {
            ...form,
            eventImageName: eventImage?.name || null
        });
    };

    return (
        <section className="calendar-create-page">
            <h1 className="calendar-create-title">Create Event</h1>

            <form className="calendar-create-card" onSubmit={handleSubmit}>
                <section className="form-section">
                    <h2>Event Type</h2>
                    <div className="type-chip-group" role="radiogroup" aria-label="Event type">
                        {EVENT_TYPES.map((type) => {
                            const isActive = form.eventType === type;

                            return (
                                <button
                                    key={type}
                                    type="button"
                                    className={`type-chip ${isActive ? 'active' : ''}`}
                                    onClick={() => handleTypeSelect(type)}
                                    aria-pressed={isActive}
                                >
                                    <span className={`chip-dot ${isActive ? 'active' : ''}`} />
                                    {type}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="form-section">
                    <h2>Event Details</h2>

                    <div className="field-grid one-column">
                        <label className="form-field">
                            <span>Title <strong>*</strong></span>
                            <input
                                type="text"
                                name="title"
                                value={form.title}
                                onChange={handleFieldChange}
                                required
                            />
                        </label>

                        <label className="form-field">
                            <span>Description <strong>*</strong></span>
                            <textarea
                                name="description"
                                value={form.description}
                                onChange={handleFieldChange}
                                maxLength={80}
                                required
                            />
                            <small>{descriptionCount}/80 characters</small>
                        </label>
                    </div>

                    <div className="field-grid two-column details-filters" ref={detailsFiltersRef}>
                        <div className="form-field details-dropdown details-genre-dropdown">
                            <span>Genre</span>
                            <button
                                type="button"
                                className={`details-dropdown-trigger ${isGenreOpen ? 'open' : ''}`}
                                onClick={() => {
                                    const nextState = !isGenreOpen;
                                    setIsGenreOpen(nextState);
                                    if (nextState) setIsMusicFormatOpen(false);
                                }}
                                aria-expanded={isGenreOpen}
                                aria-haspopup="listbox"
                            >
                                <span>{getGenreLabel()}</span>
                                <span className="details-dropdown-caret">▾</span>
                            </button>

                            {isGenreOpen && (
                                <div className="details-dropdown-panel organiser-dropdown-panel" role="listbox" aria-label="Select genres">
                                    <div className="organiser-dropdown-options">
                                        <label className={`organiser-option ${isAllGenresSelected ? 'active' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={isAllGenresSelected}
                                                onChange={() => toggleGenreOption('All Genres')}
                                            />
                                            <span>All Genres</span>
                                        </label>

                                        {GENRE_OPTIONS.map((option) => {
                                            const isChecked = form.genres.includes(option);
                                            return (
                                                <label key={option} className={`organiser-option ${isChecked ? 'active' : ''}`}>
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
                                </div>
                            )}
                        </div>

                        <div className="form-field details-dropdown details-music-dropdown">
                            <span>Music Format</span>
                            <button
                                type="button"
                                className={`details-dropdown-trigger ${isMusicFormatOpen ? 'open' : ''}`}
                                onClick={() => {
                                    const nextState = !isMusicFormatOpen;
                                    setIsMusicFormatOpen(nextState);
                                    if (nextState) setIsGenreOpen(false);
                                }}
                                aria-expanded={isMusicFormatOpen}
                                aria-haspopup="listbox"
                            >
                                <span>{form.musicFormat}</span>
                                <span className="details-dropdown-caret">▾</span>
                            </button>

                            {isMusicFormatOpen && (
                                <div className="details-dropdown-panel music-format-dropdown-panel" role="listbox" aria-label="Select music format">
                                    <div className="music-format-dropdown-options">
                                        {MUSIC_FORMAT_OPTIONS.map((option) => {
                                            const isChecked = form.musicFormat === option;
                                            return (
                                                <label key={option} className={`music-format-option ${isChecked ? 'active' : ''}`}>
                                                    <input
                                                        type="radio"
                                                        name="musicFormat"
                                                        checked={isChecked}
                                                        onChange={() => handleMusicFormatSelect(option)}
                                                    />
                                                    <span>{option}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="field-grid two-column details-row">
                        <label className="form-field hosted-by-field">
                            <span>Hosted by</span>
                            <input type="text" value={hostName} disabled />
                        </label>

                        <div className="form-field upload-field">
                            <span>Image (optional)</span>
                            <div className="upload-control">
                                <label htmlFor="event-image" className="upload-button">Choose file</label>
                                <input id="event-image" type="file" accept="image/*" onChange={handleImageChange} />
                                <span className="file-name">{eventImage ? eventImage.name : 'No file chosen'}</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="form-section">
                    <h2>Date & Time</h2>
                    <div className="field-grid date-time-grid">
                        <label className="form-field">
                            <span>From <strong>*</strong></span>
                            <input
                                type="date"
                                name="startDate"
                                value={form.startDate}
                                onChange={handleFieldChange}
                                required
                            />
                        </label>

                        <label className="form-field">
                            <span>Start <strong>*</strong></span>
                            <input
                                type="time"
                                name="startTime"
                                value={form.startTime}
                                onChange={handleFieldChange}
                                required
                            />
                        </label>

                        <label className="form-field">
                            <span>End</span>
                            <input
                                type="time"
                                name="endTime"
                                value={form.endTime}
                                onChange={handleFieldChange}
                            />
                        </label>
                    </div>
                </section>

                <section className="form-section">
                    <h2>Location</h2>
                    <div className="field-grid two-column">
                        <label className="form-field">
                            <span>Venue</span>
                            <input type="text" name="venue" value={form.venue} onChange={handleFieldChange} />
                        </label>

                        <label className="form-field">
                            <span>Address <strong>*</strong></span>
                            <input type="text" name="address" value={form.address} onChange={handleFieldChange} required />
                        </label>
                    </div>

                    <label className="inline-check">
                        <input type="checkbox" name="onlineEvent" checked={form.onlineEvent} onChange={handleFieldChange} />
                        <span>This is an online event</span>
                    </label>
                </section>

                <section className="form-section">
                    <h2>Tickets</h2>

                    <div className="field-grid tickets-grid">
                        <label className="form-field ticket-type-field">
                            <span>Select Type</span>
                            <select name="ticketType" value={form.ticketType} onChange={handleFieldChange}>
                                <option value="prepaid">Pre - paid</option>
                                <option value="door">Pay at the door</option>
                            </select>
                        </label>

                        <div className={`ticket-price-row ${form.fixedPrice ? 'single-price' : ''}`}>
                            <label className="form-field ticket-min-field">
                                <span>Price <strong>*</strong></span>
                                <input
                                    type="number"
                                    name="minPrice"
                                    placeholder={form.fixedPrice ? 'Price' : 'Min'}
                                    min="0"
                                    value={form.minPrice}
                                    onChange={handleFieldChange}
                                    disabled={form.freeEvent}
                                    required={!form.freeEvent}
                                />
                            </label>

                            {!form.fixedPrice && (
                                <label className="form-field ticket-max-field">
                                    <span className="ticket-max-label-spacer" aria-hidden="true">Price</span>
                                    <input
                                        type="number"
                                        name="maxPrice"
                                        placeholder="Max"
                                        min="0"
                                        value={form.maxPrice}
                                        onChange={handleFieldChange}
                                        disabled={form.freeEvent}
                                        required={!form.freeEvent}
                                    />
                                </label>
                            )}

                            <label className="form-field currency-field">
                                <span>Currency <strong>*</strong></span>
                                <select name="currency" value={form.currency} onChange={handleFieldChange}>
                                    {CURRENCIES.map((currency) => (
                                        <option key={currency} value={currency}>{currency}</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <label className="inline-check ticket-free-check">
                            <input type="checkbox" name="freeEvent" checked={form.freeEvent} onChange={handleFieldChange} />
                            <span>This event is free</span>
                        </label>

                        <label className="inline-check fixed-price-check">
                            <input type="checkbox" name="fixedPrice" checked={form.fixedPrice} onChange={handleFieldChange} disabled={form.freeEvent} />
                            <span>Fixed price</span>
                        </label>

                        <p className="tickets-note">
                            Note: If you are offering discounted ticket (e.g., student discount) please specify the conditions in the event description.
                        </p>
                    </div>

                    <div className="field-grid resale-grid">
                        <label className="form-field resale-link-field">
                            <span>Link to "Get Ticket"</span>
                            <input type="url" name="ticketLink" value={form.ticketLink} onChange={handleFieldChange} placeholder="https://" />
                        </label>

                        <fieldset className="radio-fieldset">
                            <legend>Allow ticket re-sell?<strong> *</strong></legend>
                            <label>
                                <input
                                    type="radio"
                                    name="allowResell"
                                    value="yes"
                                    checked={form.allowResell === 'yes'}
                                    onChange={handleFieldChange}
                                />
                                Yes
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="allowResell"
                                    value="no"
                                    checked={form.allowResell === 'no'}
                                    onChange={handleFieldChange}
                                />
                                No
                            </label>
                        </fieldset>

                        <fieldset className="radio-fieldset">
                            <legend>When re-sell is allowed?<strong> *</strong></legend>
                            {RESALE_OPTIONS.map((option) => (
                                <label key={option}>
                                    <input
                                        type="radio"
                                        name="resellCondition"
                                        value={option}
                                        checked={form.resellCondition === option}
                                        onChange={handleFieldChange}
                                        disabled={form.allowResell === 'no'}
                                    />
                                    {option}
                                </label>
                            ))}
                        </fieldset>
                    </div>
                </section>

                <section className="form-section">
                    <h2>Social Links</h2>
                    <div className="field-grid two-column">
                        <label className="form-field">
                            <span>Instagram</span>
                            <input type="url" name="instagram" value={form.instagram} onChange={handleFieldChange} placeholder="https://" />
                        </label>

                        <label className="form-field">
                            <span>Facebook</span>
                            <input type="url" name="facebook" value={form.facebook} onChange={handleFieldChange} placeholder="https://" />
                        </label>

                        <label className="form-field">
                            <span>YouTube</span>
                            <input type="url" name="youtube" value={form.YouTube} onChange={handleFieldChange} placeholder="https://" />
                        </label>

                        <label className="form-field">
                            <span>LinkedIn</span>
                            <input type="url" name="linkedin" value={form.linkedin} onChange={handleFieldChange} placeholder="https://" />
                        </label>

                        <label className="form-field span-2">
                            <span>Your Website</span>
                            <input type="url" name="website" value={form.website} onChange={handleFieldChange} placeholder="https://" />
                        </label>
                    </div>
                </section>

                <section className="form-section">
                    <h2>Contacts (co-host)</h2>
                    <p className="contact-copy">
                        You are automatically included as the main contact. Add more users who can be contacted regarding the event.
                    </p>

                    <label className="form-field cohost-field">
                        <span>Add co-hosts</span>
                        <input
                            type="text"
                            name="coHosts"
                            value={form.coHosts}
                            onChange={handleFieldChange}
                            placeholder="Search by name or email"
                        />
                    </label>

                    <small className="cohost-help">Co-hosts can accept or decline once you've published your event.</small>
                </section>

                <div className="form-actions">
                    <button type="submit" className="btn-primary">Create event</button>
                    <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard/calendar')}>
                        Cancel
                    </button>
                </div>
            </form>
        </section>
    );
}
