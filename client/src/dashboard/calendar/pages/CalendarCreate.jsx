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
    const { user, setAuthenticatedUser } = useAuth();
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const [form, setForm] = useState(initialFormState);
    const [eventImage, setEventImage] = useState(null);
    const [eventImagePreview, setEventImagePreview] = useState('');
    const [isGenreOpen, setIsGenreOpen] = useState(false);
    const [isMusicFormatOpen, setIsMusicFormatOpen] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [formMessage, setFormMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const detailsFiltersRef = useRef(null);

    const descriptionCount = form.description.length;
    const hostName = useMemo(() => getHostName(user), [user]);
    const isAllGenresSelected = form.genres.length === GENRE_OPTIONS.length;
    const canCreateEvent = user?.role === 'organiser' || user?.role === 'admin';

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

    useEffect(() => {
        if (!eventImage) {
            setEventImagePreview('');
            return;
        }

        const objectUrl = URL.createObjectURL(eventImage);
        setEventImagePreview(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [eventImage]);

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
        if (file && !file.type.startsWith('image/')) {
            setFieldErrors((prev) => ({ ...prev, eventImage: 'Please upload an image file.' }));
            setEventImage(null);
            return;
        }

        if (file && file.size > 5 * 1024 * 1024) {
            setFieldErrors((prev) => ({ ...prev, eventImage: 'Image must be 5MB or smaller.' }));
            setEventImage(null);
            return;
        }

        setFieldErrors((prev) => {
            if (!prev.eventImage) return prev;
            const next = { ...prev };
            delete next.eventImage;
            return next;
        });
        setEventImage(file);
    };

    const normalizeUrl = (value) => {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        if (!trimmed) return '';

        const prefixed = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, '')}`;
        try {
            const parsed = new URL(prefixed);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
            return parsed.toString();
        } catch {
            return '';
        }
    };

    const validateForm = () => {
        const nextErrors = {};

        const startDate = form.startDate;
        const startTime = form.startTime;
        const endTime = form.endTime;

        if (!form.title.trim()) {
            nextErrors.title = 'Title is required.';
        }

        if (!form.description.trim()) {
            nextErrors.description = 'Description is required.';
        }

        if (!startDate) {
            nextErrors.startDate = 'Date is required.';
        }

        if (!startTime) {
            nextErrors.startTime = 'Start time is required.';
        }

        if (!form.address.trim()) {
            nextErrors.address = 'Address is required.';
        }

        if (startDate && startTime && endTime) {
            const start = new Date(`${startDate}T${startTime}`);
            const end = new Date(`${startDate}T${endTime}`);
            if (end <= start) {
                nextErrors.endTime = 'End time must be after start time.';
            }
        }

        if (!form.freeEvent) {
            const min = Number(form.minPrice);
            const max = Number(form.maxPrice);

            if (Number.isNaN(min) || min < 0) {
                nextErrors.minPrice = 'Minimum price must be a number greater than or equal to 0.';
            }

            if (Number.isNaN(max) || max < 0) {
                nextErrors.maxPrice = 'Maximum price must be a number greater than or equal to 0.';
            }

            if (!Number.isNaN(min) && !Number.isNaN(max)) {
                if (form.fixedPrice && min !== max) {
                    nextErrors.maxPrice = 'For fixed price, both values must match.';
                }

                if (!form.fixedPrice && max < min) {
                    nextErrors.maxPrice = 'Maximum price must be greater than or equal to minimum price.';
                }
            }
        }

        const urlFields = ['ticketLink', 'instagram', 'facebook', 'youtube', 'linkedin', 'website'];
        for (const fieldName of urlFields) {
            const value = form[fieldName];
            if (!value?.trim()) continue;
            if (!normalizeUrl(value)) {
                nextErrors[fieldName] = 'Please enter a valid URL.';
            }
        }

        return nextErrors;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!canCreateEvent) {
            setFormMessage('Only organisers and admins can create events.');
            return;
        }

        const validationErrors = validateForm();
        setFieldErrors(validationErrors);
        setFormMessage('');

        if (Object.keys(validationErrors).length > 0) {
            setFormMessage('Please fix the highlighted fields before submitting.');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = new FormData();
            payload.append('eventType', form.eventType);
            payload.append('title', form.title.trim());
            payload.append('description', form.description.trim());
            payload.append('genres', JSON.stringify(form.genres));
            payload.append('musicFormat', form.musicFormat);
            payload.append('startDate', form.startDate);
            payload.append('startTime', form.startTime);
            payload.append('endTime', form.endTime);
            payload.append('venue', form.venue.trim());
            payload.append('address', form.address.trim());
            payload.append('onlineEvent', String(form.onlineEvent));
            payload.append('ticketType', form.ticketType);
            payload.append('freeEvent', String(form.freeEvent));
            payload.append('minPrice', form.freeEvent ? '0' : String(form.minPrice || '0'));
            payload.append('maxPrice', form.freeEvent ? '0' : String((form.fixedPrice ? form.minPrice : form.maxPrice) || '0'));
            payload.append('fixedPrice', String(form.fixedPrice));
            payload.append('currency', form.currency);
            payload.append('ticketLink', form.ticketLink.trim());
            payload.append('allowResell', form.allowResell);
            payload.append('resellCondition', form.resellCondition);
            payload.append('instagram', form.instagram.trim());
            payload.append('facebook', form.facebook.trim());
            payload.append('youtube', form.youtube.trim());
            payload.append('linkedin', form.linkedin.trim());
            payload.append('website', form.website.trim());
            payload.append('coHosts', form.coHosts.trim());

            if (eventImage) {
                payload.append('eventImage', eventImage);
            }

            const response = await fetch(`${API_URL}/api/calendar/events`, {
                method: 'POST',
                credentials: 'include',
                body: payload,
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to create event.');
            }

            setFormMessage('Event created successfully. Redirecting...');
            setForm(initialFormState);
            setEventImage(null);

            if (data.activityLine) {
                setAuthenticatedUser((previous) => {
                    if (!previous) return previous;
                    const currentActivity = typeof previous.activity === 'string' ? previous.activity.trim() : '';
                    const nextActivity = currentActivity
                        ? `${data.activityLine}\n${currentActivity}`.slice(0, 1000)
                        : String(data.activityLine).slice(0, 1000);
                    const currentFeed = Array.isArray(previous.activityFeed) ? previous.activityFeed : [];
                    const nextFeed = data.activityItem
                        ? [data.activityItem, ...currentFeed].slice(0, 30)
                        : currentFeed;

                    return {
                        ...previous,
                        activity: nextActivity,
                        activityFeed: nextFeed,
                    };
                });
            }

            window.setTimeout(() => {
                navigate('/dashboard/calendar');
            }, 500);
        } catch (submitError) {
            setFormMessage(submitError.message || 'Unable to create event.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="calendar-create-page">
            <h1 className="calendar-create-title">Create Event</h1>

            <form className="calendar-create-card" onSubmit={handleSubmit}>
                {!canCreateEvent ? (
                    <p className="calendar-create-message">
                        Only users with organiser or admin role can publish events.
                    </p>
                ) : null}
                {formMessage ? <p className="calendar-create-message">{formMessage}</p> : null}
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
                            {fieldErrors.title ? <small className="field-error">{fieldErrors.title}</small> : null}
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
                            {fieldErrors.description ? <small className="field-error">{fieldErrors.description}</small> : null}
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
                            {eventImagePreview ? (
                                <img src={eventImagePreview} alt="Event preview" className="event-image-preview" />
                            ) : null}
                            {fieldErrors.eventImage ? <small className="field-error">{fieldErrors.eventImage}</small> : null}
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
                            {fieldErrors.startDate ? <small className="field-error">{fieldErrors.startDate}</small> : null}
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
                            {fieldErrors.startTime ? <small className="field-error">{fieldErrors.startTime}</small> : null}
                        </label>

                        <label className="form-field">
                            <span>End</span>
                            <input
                                type="time"
                                name="endTime"
                                value={form.endTime}
                                onChange={handleFieldChange}
                            />
                            {fieldErrors.endTime ? <small className="field-error">{fieldErrors.endTime}</small> : null}
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
                            {fieldErrors.address ? <small className="field-error">{fieldErrors.address}</small> : null}
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
                                {fieldErrors.minPrice ? <small className="field-error">{fieldErrors.minPrice}</small> : null}
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
                                    {fieldErrors.maxPrice ? <small className="field-error">{fieldErrors.maxPrice}</small> : null}
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
                            {fieldErrors.ticketLink ? <small className="field-error">{fieldErrors.ticketLink}</small> : null}
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
                            {fieldErrors.instagram ? <small className="field-error">{fieldErrors.instagram}</small> : null}
                        </label>

                        <label className="form-field">
                            <span>Facebook</span>
                            <input type="url" name="facebook" value={form.facebook} onChange={handleFieldChange} placeholder="https://" />
                            {fieldErrors.facebook ? <small className="field-error">{fieldErrors.facebook}</small> : null}
                        </label>

                        <label className="form-field">
                            <span>YouTube</span>
                            <input type="url" name="youtube" value={form.youtube} onChange={handleFieldChange} placeholder="https://" />
                            {fieldErrors.youtube ? <small className="field-error">{fieldErrors.youtube}</small> : null}
                        </label>

                        <label className="form-field">
                            <span>LinkedIn</span>
                            <input type="url" name="linkedin" value={form.linkedin} onChange={handleFieldChange} placeholder="https://" />
                            {fieldErrors.linkedin ? <small className="field-error">{fieldErrors.linkedin}</small> : null}
                        </label>

                        <label className="form-field span-2">
                            <span>Your Website</span>
                            <input type="url" name="website" value={form.website} onChange={handleFieldChange} placeholder="https://" />
                            {fieldErrors.website ? <small className="field-error">{fieldErrors.website}</small> : null}
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
                    <button type="submit" className="btn-primary" disabled={isSubmitting || !canCreateEvent}>
                        {isSubmitting ? 'Creating...' : 'Create event'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard/calendar')}>
                        Cancel
                    </button>
                </div>
            </form>
        </section>
    );
}
