// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Create Page Guide
 * UI page where users build and submit new events.
 * This layer translates form interactions into backend-ready payload behavior.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import '../styles/CalendarCreate.css';

// ── Event type and configuration constants ──────────────────────────────
// These are the event categories users can choose from when creating an event.
// FR31: EVENT_TYPES defines the selectable event type options (Social, Class, Workshop, Festival) for Organisers and Admins.
const EVENT_TYPES = ['Social', 'Class', 'Workshop', 'Festival'];
const DEFAULT_CURRENCIES = ['GBP', 'EUR', 'USD'];
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
// Builds the currency dropdown list from Intl support, with safe fallbacks.
const CURRENCIES = (() => {
    // Guard condition: validate prerequisites before continuing.
    if (typeof Intl === 'undefined' || typeof Intl.supportedValuesOf !== 'function') {
        return [...DEFAULT_CURRENCIES];
    }

    const supportedCurrencies = Intl.supportedValuesOf('currency')
        .map((currency) => String(currency || '').trim().toUpperCase())
        .filter((currency) => CURRENCY_CODE_PATTERN.test(currency));

    const unique = Array.from(new Set([...DEFAULT_CURRENCIES, ...supportedCurrencies]));
    return unique.sort((left, right) => left.localeCompare(right));
})();
// Resale and music preferences for the event.
const RESALE_OPTIONS = ['When tickets are sold-out', 'Always'];
const GENRE_OPTIONS = ['Lindy Hop', 'Collegiate Shag', 'Balboa', 'Jive', 'Boogie Woogie', 'West/East Coast', 'Charleston'];
const MUSIC_FORMAT_OPTIONS = ['Both', 'DJ', 'Live music'];
const PAID_TICKET_TYPE_LABELS = {
    prepaid: 'Pre - paid',
    door: 'Pay at the door',
};
const FREE_TICKET_TYPE_LABELS = {
    prepaid: 'Booking required',
    door: 'No-booking required',
};
// Time slots at 15-minute intervals for start and end times (96 slots = 1440 minutes = 24 hours).
const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
    const minutesSinceMidnight = index * 15;
    const hours = String(Math.floor(minutesSinceMidnight / 60)).padStart(2, '0');
    const minutes = String(minutesSinceMidnight % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
});

// ── Helper functions ──────────────────────────────────────────────────
// Ensure currency codes are uppercase and match the ISO 4217 format (3 letters).
const normalizeCurrencyCode = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    return CURRENCY_CODE_PATTERN.test(normalized) ? normalized : '';
};

// Extract the display name from user object, preferring display names over auth names.
const getHostName = (user) => {
    // Guard condition: validate prerequisites before continuing.
    if (!user) return 'Main host';

    const first = user.displayFirstName || user.firstName || '';
    const last = user.displayLastName || user.lastName || '';
    const fullName = `${first} ${last}`.trim();

    return fullName || user.email || 'Main host';
};

// Returns one display-safe name for mixed member/organisation candidate entries.
const getDiscoverableName = (entry) => {
    // Guard condition: validate prerequisites before continuing.
    if (!entry || typeof entry !== 'object') return '';
    // Guard condition: validate prerequisites before continuing.
    if (entry.entityType === 'organisation') {
        return String(entry.displayFirstName || '').trim() || 'Swinggity Organisation';
    }

    const first = String(entry.displayFirstName || '').trim();
    const last = String(entry.displayLastName || '').trim();
    return `${first} ${last}`.trim() || 'Swinggity Member';
};

// Produces a stable composite key for co-host identity and de-duplication.
const buildCoHostContactKey = (entry) => {
    const userId = String(entry?.userId || entry?.user || '').trim();
    const entityType = entry?.entityType === 'organisation' ? 'organisation' : 'member';
    const organisationId = String(entry?.organisationId || '').trim();
    return `${userId}|${entityType}|${organisationId}`;
};

// Joins date/time values into a sortable timestamp-like key.
const buildDateTimeKey = (date, time) => {
    // Guard condition: validate prerequisites before continuing.
    if (!date || !time) return '';
    return `${date}T${time}`;
};

// ── Initial form state ────────────────────────────────────────────────
// All event form fields start empty or with sensible defaults.
const initialFormState = {
    eventType: 'Social',
    title: '',
    description: '',
    genres: [...GENRE_OPTIONS],
    musicFormat: 'Both',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    venue: '',
    address: '',
    city: '',
    ticketType: 'prepaid',
    freeEvent: false,
    minPrice: '',
    maxPrice: '',
    fixedPrice: false,
    currency: 'GBP',
    ticketLink: '',
    allowResell: 'no',
    resellCondition: 'When tickets are sold-out',
    instagram: '',
    facebook: '',
    youtube: '',
    linkedin: '',
    website: '',
    coHosts: ''
};

// Maps existing event payload fields into the create/edit form state shape.
const buildFormStateFromEvent = (event) => ({
    eventType: event?.eventType || 'Social',
    title: event?.title || '',
    description: event?.description || '',
    genres: Array.isArray(event?.genres) && event.genres.length > 0 ? event.genres : [...GENRE_OPTIONS],
    musicFormat: event?.musicFormat === 'All' ? 'Both' : (event?.musicFormat || 'Both'),
    startDate: event?.startDate || '',
    startTime: event?.startTime || '',
    endDate: event?.endDate || (event?.endTime ? event?.startDate || '' : ''),
    endTime: event?.endTime || '',
    venue: event?.venue || '',
    address: event?.address || '',
    city: event?.city || '',
    ticketType: event?.ticketType || 'prepaid',
    freeEvent: Boolean(event?.freeEvent),
    minPrice: Number.isFinite(event?.minPrice) ? String(event.minPrice) : '',
    maxPrice: Number.isFinite(event?.maxPrice) ? String(event.maxPrice) : '',
    fixedPrice: Boolean(event?.fixedPrice),
    currency: event?.currency || 'GBP',
    ticketLink: event?.ticketLink || '',
    allowResell: event?.allowResell || 'no',
    resellCondition: event?.resellCondition || 'When tickets are sold-out',
    instagram: event?.onlineLinks?.instagram || '',
    facebook: event?.onlineLinks?.facebook || '',
    youtube: event?.onlineLinks?.youtube || '',
    linkedin: event?.onlineLinks?.linkedin || '',
    website: event?.onlineLinks?.website || '',
    coHosts: event?.coHosts || '',
});

/**
 * CalendarCreatePage:
 * Main create/edit event form page with validation, media upload, location lookup,
 * and submission logic for both new events and existing event updates.
 */
export default function CalendarCreatePage() {
    // ── Router and auth context ────────────────────────────────────────
    const navigate = useNavigate();
    const { eventId } = useParams();
    const { user, setAuthenticatedUser, isLoading: isAuthLoading } = useAuth();
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const isEditingEvent = Boolean(eventId);

    // ── Form and UI state ────────────────────────────────────────────────
    const [form, setForm] = useState(initialFormState);
    const [eventImage, setEventImage] = useState(null);
    const [eventImagePreview, setEventImagePreview] = useState('');

    // Dropdown open/close states for each form section.
    const [isGenreOpen, setIsGenreOpen] = useState(false);
    const [isMusicFormatOpen, setIsMusicFormatOpen] = useState(false);
    const [isTicketTypeOpen, setIsTicketTypeOpen] = useState(false);
    const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
    const [isStartTimeOpen, setIsStartTimeOpen] = useState(false);
    const [isEndTimeOpen, setIsEndTimeOpen] = useState(false);
    const [isCoHostOpen, setIsCoHostOpen] = useState(false);

    // Per-field validation errors displayed below each input.
    const [fieldErrors, setFieldErrors] = useState({});
    const [formMessage, setFormMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingEditEvent, setIsLoadingEditEvent] = useState(false);
    const [hasEndDateTime, setHasEndDateTime] = useState(false);  // Toggle to show/hide end date and time fields.
    const formContainerRef = useRef(null);
    const addressAutocompleteRef = useRef(null);
    const suppressAddressFetchRef = useRef('');
    // ── Address autocomplete state ────────────────────────────────────────
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [isAddressOpen, setIsAddressOpen] = useState(false);
    const [isAddressLoading, setIsAddressLoading] = useState(false);
    const [addressError, setAddressError] = useState('');
    const [highlightedAddressIndex, setHighlightedAddressIndex] = useState(-1);
    // ── Co-host contact state ────────────────────────────────────────────
    const [coHostCandidates, setCoHostCandidates] = useState([]);
    const [coHostQuery, setCoHostQuery] = useState('');
    const [selectedCoHost, setSelectedCoHost] = useState(null);
    const [acceptedCoHosts, setAcceptedCoHosts] = useState([]);
    const [initialAcceptedCoHostKeys, setInitialAcceptedCoHostKeys] = useState([]);
    // ── Publisher (member or organisation) state ──────────────────────────
    const [userOrganisation, setUserOrganisation] = useState(null);
    const [publisherType, setPublisherType] = useState('member');
    const [isPublisherTypeOpen, setIsPublisherTypeOpen] = useState(false);

    // ── Computed values (memoized for performance) ─────────────────────────
    const titleCount = form.title.length;
    const descriptionCount = form.description.length;
    const hostName = useMemo(() => getHostName(user), [user]);
    // Determine whether to display member name or organisation name as publisher.
    const selectedPublisherName = useMemo(() => {
        // Guard condition: validate prerequisites before continuing.
        if (publisherType === 'organisation' && userOrganisation?.organisationName) {
            return userOrganisation.organisationName;
        }

        return hostName;
    }, [hostName, publisherType, userOrganisation]);
    const currencyOptions = useMemo(() => {
        const normalizedCurrent = normalizeCurrencyCode(form.currency);
        // Guard condition: validate prerequisites before continuing.
        if (!normalizedCurrent || CURRENCIES.includes(normalizedCurrent)) {
            return CURRENCIES;
        }

        return [normalizedCurrent, ...CURRENCIES];
    }, [form.currency]);
    // ── Role-based feature gates ──────────────────────────────────────────
    // Only organisers and admins can create events; admins skip image/cohost flows.
    const isAllGenresSelected = form.genres.length === GENRE_OPTIONS.length;
    const normalizedUserRole = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : '';
    const canCreateEvent = normalizedUserRole === 'organiser' || normalizedUserRole === 'organizer' || normalizedUserRole === 'admin';
    const isAdminUser = normalizedUserRole === 'admin';
    const canUploadEventImage = !isAdminUser;
    const canManageCoHosts = !isAdminUser;
    const endTimeOptions = useMemo(() => {
        // Guard condition: validate prerequisites before continuing.
        if (!hasEndDateTime) {
            return TIME_OPTIONS;
        }

        // Guard condition: validate prerequisites before continuing.
        if (!form.endDate || !form.startDate || !form.startTime || form.endDate !== form.startDate) {
            return TIME_OPTIONS;
        }

        return TIME_OPTIONS.filter((time) => time > form.startTime);
    }, [form.endDate, form.startDate, form.startTime, hasEndDateTime]);
    const filteredCoHostCandidates = useMemo(() => {
        const query = coHostQuery.trim().toLowerCase();
        // Guard condition: validate prerequisites before continuing.
        if (!query) return coHostCandidates;

        return coHostCandidates.filter((entry) => {
            const name = getDiscoverableName(entry).toLowerCase();
            const email = String(entry.email || '').trim().toLowerCase();
            return name.includes(query) || email.includes(query);
        });
    }, [coHostCandidates, coHostQuery]);

    // Closes every dropdown/select panel to keep interaction state synchronized.
    const closeAllDropdowns = useCallback(() => {
        setIsGenreOpen(false);
        setIsMusicFormatOpen(false);
        setIsTicketTypeOpen(false);
        setIsCurrencyOpen(false);
        setIsStartTimeOpen(false);
        setIsEndTimeOpen(false);
        setIsCoHostOpen(false);
        setIsAddressOpen(false);
        setIsPublisherTypeOpen(false);
        setHighlightedAddressIndex(-1);
    }, []);

    // Opens one dropdown at a time and closes all others.
    const openOnlyDropdown = useCallback((dropdownName) => {
        setIsGenreOpen(dropdownName === 'genre');
        setIsMusicFormatOpen(dropdownName === 'music');
        setIsTicketTypeOpen(dropdownName === 'ticket');
        setIsCurrencyOpen(dropdownName === 'currency');
        setIsStartTimeOpen(dropdownName === 'startTime');
        setIsEndTimeOpen(dropdownName === 'endTime');
        setIsCoHostOpen(dropdownName === 'cohost');
        setIsAddressOpen(dropdownName === 'address');
        setIsPublisherTypeOpen(dropdownName === 'publisher');

        // Guard condition: validate prerequisites before continuing.
        if (dropdownName !== 'address') {
            setHighlightedAddressIndex(-1);
        }
    }, []);

    useEffect(() => {
        const handleDocumentMouseDown = (event) => {
            // Guard condition: validate prerequisites before continuing.
            if (formContainerRef.current && !formContainerRef.current.contains(event.target)) {
                closeAllDropdowns();
            }
        };

        document.addEventListener('mousedown', handleDocumentMouseDown);
        return () => {
            document.removeEventListener('mousedown', handleDocumentMouseDown);
        };
    }, [closeAllDropdowns]);

    useEffect(() => {
        // Guard condition: validate prerequisites before continuing.
        if (!canManageCoHosts) {
            setCoHostCandidates([]);
            return undefined;
        }

        let isMounted = true;

        // Loads member candidates that can be selected as event co-host contacts.
        const fetchCandidates = async () => {
            try {
                const response = await fetch(`${API_URL}/api/members`, {
                    credentials: 'include',
                });
                const data = await response.json();
                // Guard condition: validate prerequisites before continuing.
                if (!response.ok || !data.success) return;

                // Guard condition: validate prerequisites before continuing.
                if (!isMounted) return;
                const members = Array.isArray(data.members) ? data.members : [];
                setCoHostCandidates(
                    members.filter((entry) => {
                        const userId = String(entry?.userId || '').trim();
                        return Boolean(userId);
                    })
                );
            } catch {
                // Guard condition: validate prerequisites before continuing.
                if (isMounted) {
                    setCoHostCandidates([]);
                }
            }
        };

        fetchCandidates();

        return () => {
            isMounted = false;
        };
    }, [API_URL, canManageCoHosts]);

    useEffect(() => {
        let isMounted = true;

        // Loads current user's organisation summary for publisher selection.
        const fetchUserOrganisation = async () => {
            try {
                const response = await fetch(`${API_URL}/api/organisation/me/summary`, {
                    credentials: 'include',
                });
                const data = await response.json();
                // Guard condition: validate prerequisites before continuing.
                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load organisation.');
                }

                // Guard condition: validate prerequisites before continuing.
                if (isMounted) {
                    setUserOrganisation(data.organisation || null);
                }
            } catch {
                // Guard condition: validate prerequisites before continuing.
                if (isMounted) {
                    setUserOrganisation(null);
                }
            }
        };

        fetchUserOrganisation();

        return () => {
            isMounted = false;
        };
    }, [API_URL]);

    useEffect(() => {
        const query = form.address.trim();

        // Guard condition: validate prerequisites before continuing.
        if (suppressAddressFetchRef.current === query) {
            suppressAddressFetchRef.current = '';
            return undefined;
        }

        // Guard condition: validate prerequisites before continuing.
        if (query.length < 2) {
            setAddressSuggestions([]);
            setAddressError('');
            setIsAddressLoading(false);
            setHighlightedAddressIndex(-1);
            return undefined;
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(async () => {
            setIsAddressLoading(true);
            setAddressError('');

            try {
                const response = await fetch(
                    `${API_URL}/api/calendar/places/autocomplete?input=${encodeURIComponent(query)}`,
                    {
                        credentials: 'include',
                        signal: controller.signal,
                    }
                );
                const data = await response.json();

                // Guard condition: validate prerequisites before continuing.
                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load places.');
                }

                const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
                setAddressSuggestions(suggestions);
                // Guard condition: validate prerequisites before continuing.
                if (suggestions.length > 0) {
                    openOnlyDropdown('address');
                } else {
                    setIsAddressOpen(false);
                }
                setHighlightedAddressIndex(suggestions.length > 0 ? 0 : -1);
            } catch (error) {
                // Guard condition: validate prerequisites before continuing.
                if (error.name === 'AbortError') return;
                setAddressSuggestions([]);
                setIsAddressOpen(false);
                setHighlightedAddressIndex(-1);
                setAddressError(error.message || 'Unable to load places.');
            } finally {
                setIsAddressLoading(false);
            }
        }, 220);

        return () => {
            controller.abort();
            window.clearTimeout(timeoutId);
        };
    }, [API_URL, form.address, openOnlyDropdown]);

    useEffect(() => {
        // Guard condition: validate prerequisites before continuing.
        if (!eventImage) return;

        const objectUrl = URL.createObjectURL(eventImage);
        setEventImagePreview(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [eventImage]);

    useEffect(() => {
        // Guard condition: validate prerequisites before continuing.
        if (!isEditingEvent || !eventId) return;

        let isCancelled = false;

        // Loads existing event data and pre-fills the form when editing.
        const loadEventForEdit = async () => {
            setIsLoadingEditEvent(true);
            setFormMessage('Loading event details...');

            try {
                const response = await fetch(`${API_URL}/api/calendar/events`, {
                    credentials: 'include',
                });
                const data = await response.json();

                // Guard condition: validate prerequisites before continuing.
                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load event details.');
                }

                const events = Array.isArray(data.events) ? data.events : [];
                const matchedEvent = events.find((item) => String(item.id || '') === String(eventId));

                // Guard condition: validate prerequisites before continuing.
                if (!matchedEvent) {
                    throw new Error('Event not found.');
                }

                // Guard condition: validate prerequisites before continuing.
                if (String(matchedEvent.createdById || '') !== String(user?._id || '')) {
                    throw new Error('You can only edit your own events.');
                }

                // Guard condition: validate prerequisites before continuing.
                if (isCancelled) return;

                const existingAcceptedCoHosts = (Array.isArray(matchedEvent.coHostContacts) ? matchedEvent.coHostContacts : [])
                    .map((entry) => {
                        const normalized = {
                            userId: String(entry?.user || '').trim(),
                            entityType: entry?.entityType === 'organisation' ? 'organisation' : 'member',
                            organisationId: String(entry?.organisationId || '').trim(),
                            displayName: String(entry?.displayName || '').trim(),
                        };

                        return {
                            ...normalized,
                            key: buildCoHostContactKey(normalized),
                        };
                    })
                    .filter((entry) => entry.userId && entry.displayName);

                setAcceptedCoHosts(existingAcceptedCoHosts);
                setInitialAcceptedCoHostKeys(existingAcceptedCoHosts.map((entry) => entry.key));
                setSelectedCoHost(null);
                setCoHostQuery('');

                setForm(buildFormStateFromEvent(matchedEvent));
                setHasEndDateTime(Boolean(matchedEvent.endDate || matchedEvent.endTime));
                setPublisherType(matchedEvent.publisherType === 'organisation' ? 'organisation' : 'member');
                setFieldErrors({});
                setEventImage(null);
                setEventImagePreview('');
                setFormMessage('');
            } catch (loadError) {
                // Guard condition: validate prerequisites before continuing.
                if (isCancelled) return;
                setFormMessage(loadError.message || 'Unable to load event details.');
            } finally {
                // Guard condition: validate prerequisites before continuing.
                if (!isCancelled) {
                    setIsLoadingEditEvent(false);
                }
            }
        };

        loadEventForEdit();

        return () => {
            isCancelled = true;
        };
    }, [API_URL, eventId, isEditingEvent, user?._id]);

    useEffect(() => {
        // Guard condition: validate prerequisites before continuing.
        if (!hasEndDateTime) return;

        // Guard condition: validate prerequisites before continuing.
        if (!form.endDate || !form.endTime || !form.startDate || !form.startTime) return;

        const startDateTime = buildDateTimeKey(form.startDate, form.startTime);
        const endDateTime = buildDateTimeKey(form.endDate, form.endTime);
        // Guard condition: validate prerequisites before continuing.
        if (startDateTime && endDateTime && endDateTime <= startDateTime) {
            setForm((prev) => ({
                ...prev,
                endTime: '',
            }));
        }
    }, [form.endDate, form.endTime, form.startDate, form.startTime, hasEndDateTime]);

    // Generic controlled-input handler with field-specific form side-effects.
    const handleFieldChange = (event) => {
        const { name, value, type, checked } = event.target;

        const nextValue = type === 'checkbox' ? checked : value;
        const shouldClearError = type === 'checkbox' ? checked : String(nextValue).trim().length > 0;
        // Guard condition: validate prerequisites before continuing.
        if (shouldClearError) {
            setFieldErrors((prev) => {
                // Guard condition: validate prerequisites before continuing.
                if (!prev[name]) return prev;
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }

        // Guard condition: validate prerequisites before continuing.
        if (name === 'fixedPrice') {
            setForm((prev) => ({
                ...prev,
                fixedPrice: checked,
                maxPrice: checked ? prev.minPrice : prev.maxPrice,
            }));
            return;
        }

        // Guard condition: validate prerequisites before continuing.
        if (name === 'minPrice') {
            setForm((prev) => ({
                ...prev,
                minPrice: value,
                maxPrice: prev.fixedPrice ? value : prev.maxPrice,
            }));
            return;
        }

        // Guard condition: validate prerequisites before continuing.
        if (name === 'startDate') {
            setForm((prev) => {
                const nextStartDate = value;
                // Guard condition: validate prerequisites before continuing.
                if (!prev.endDate || prev.endDate >= nextStartDate) {
                    return {
                        ...prev,
                        startDate: nextStartDate,
                    };
                }

                return {
                    ...prev,
                    startDate: nextStartDate,
                    endDate: nextStartDate,
                };
            });
            return;
        }

        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // ── Event type selector ────────────────────────────────────────────────────
    // Updates selected event type (Social, Class, Workshop, Festival).
    const handleTypeSelect = (type) => {
        setForm((prev) => ({ ...prev, eventType: type }));
    };

    // Applies selected address suggestion: updates address, city, venue, currency.
    // Prevents re-fetching the same address via suppressAddressFetchRef.
    const applyAddressSuggestion = (suggestion) => {
        // Guard condition: validate prerequisites before continuing.
        if (!suggestion) return;

        const selectedAddress = String(suggestion.description || suggestion.secondaryText || suggestion.primaryText || '').trim();
        const nextCurrency = normalizeCurrencyCode(suggestion.currency);
        suppressAddressFetchRef.current = selectedAddress;

        setForm((prev) => ({
            ...prev,
            address: selectedAddress,
            city: String(suggestion.city || '').trim() || prev.city,
            venue: prev.venue.trim() ? prev.venue : String(suggestion.primaryText || '').trim(),
            currency: nextCurrency || prev.currency,
        }));
        setFieldErrors((prev) => {
            // Guard condition: validate prerequisites before continuing.
            if (!prev.address) return prev;
            const next = { ...prev };
            delete next.address;
            return next;
        });
        setAddressSuggestions([]);
        closeAllDropdowns();
        setAddressError('');
    };

    // ── Address input handlers ────────────────────────────────────────
    // Updates address field and opens dropdown to show suggestions.
    const handleAddressChange = (event) => {
        handleFieldChange(event);
        openOnlyDropdown('address');
    };

    // Opens address dropdown if suggestions are available when field is focused.
    const handleAddressFocus = () => {
        // Guard condition: validate prerequisites before continuing.
        if (addressSuggestions.length > 0) {
            openOnlyDropdown('address');
        }
    };
    // Keyboard navigation for address dropdown: arrow keys move highlight, Enter selects, Escape closes.

    const handleAddressKeyDown = (event) => {
        // Guard condition: validate prerequisites before continuing.
        if (!isAddressOpen || addressSuggestions.length === 0) {
            return;
        }

        // Guard condition: validate prerequisites before continuing.
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlightedAddressIndex((prev) => (prev < addressSuggestions.length - 1 ? prev + 1 : 0));
            return;
        }

        // Guard condition: validate prerequisites before continuing.
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedAddressIndex((prev) => (prev > 0 ? prev - 1 : addressSuggestions.length - 1));
            return;
        }

        // Guard condition: validate prerequisites before continuing.
        if (event.key === 'Enter') {
            // Guard condition: validate prerequisites before continuing.
            if (highlightedAddressIndex >= 0 && highlightedAddressIndex < addressSuggestions.length) {
                event.preventDefault();
                applyAddressSuggestion(addressSuggestions[highlightedAddressIndex]);
            }
            return;
        }

        // Guard condition: validate prerequisites before continuing.
        if (event.key === 'Escape') {
            event.preventDefault();
            closeAllDropdowns();
        }
    };
    // ── Genre display helper ──────────────────────────────────────
    // Returns dropdown label: "All Genres", specific genre, or count (e.g., "3 Genres").

    const getGenreLabel = () => {
        // Guard condition: validate prerequisites before continuing.
        if (form.genres.length === GENRE_OPTIONS.length || form.genres.length === 0) {
            return 'All Genres';
        }

        // Guard condition: validate prerequisites before continuing.
        if (form.genres.length === 1) {
            return form.genres[0];
        }

        return `${form.genres.length} Genres`;
        // Toggles genre on/off: "All Genres" selects/clears all, individual options add/remove one.
    };

    const toggleGenreOption = (option) => {
        setForm((prev) => {
            // Guard condition: validate prerequisites before continuing.
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
            // ── Dropdown selection handlers ────────────────────────────────────────
            // Updates form field and clears associated error, then closes all dropdowns.
        });
    };

    // Sets selected music format and clears its validation error state.
    const handleMusicFormatSelect = (option) => {
        setForm((prev) => ({ ...prev, musicFormat: option }));
        setFieldErrors((prev) => {
            // Guard condition: validate prerequisites before continuing.
            if (!prev.musicFormat) return prev;
            const next = { ...prev };
            delete next.musicFormat;
            return next;
        });
        // Handles ticket type selection (prepaid vs door payment).
        closeAllDropdowns();
    };

    // Sets ticket type (prepaid/door) and clears validation error state.
    const handleTicketTypeSelect = (type) => {
        setForm((prev) => ({ ...prev, ticketType: type }));
        setFieldErrors((prev) => {
            // Guard condition: validate prerequisites before continuing.
            if (!prev.ticketType) return prev;
            const next = { ...prev };
            delete next.ticketType;
            return next;
        });
        // Handles currency code selection (GBP, EUR, USD, etc).
        closeAllDropdowns();
    };

    // Sets currency selection and clears validation error state.
    const handleCurrencySelect = (currency) => {
        setForm((prev) => ({ ...prev, currency }));
        setFieldErrors((prev) => {
            // Guard condition: validate prerequisites before continuing.
            if (!prev.currency) return prev;
            const next = { ...prev };
            delete next.currency;
            return next;
            // Handles start time selection (15-minute intervals, 00:00 to 23:45).
        });
        closeAllDropdowns();
    };

    // Sets event start time from dropdown selection.
    const handleStartTimeSelect = (time) => {
        setForm((prev) => ({
            ...prev,
            startTime: time,
        }));
        setFieldErrors((prev) => {
            // Guard condition: validate prerequisites before continuing.
            if (!prev.startTime) return prev;
            const next = { ...prev };
            delete next.startTime;
            return next;
        });
        closeAllDropdowns();
    };

    // Handles end time selection (filtered to times after startTime when on same date).
    const handleEndTimeSelect = (time) => {
        setForm((prev) => ({
            ...prev,
            endTime: time,
        }));
        setFieldErrors((prev) => {
            // Guard condition: validate prerequisites before continuing.
            if (!prev.endTime) return prev;
            const next = { ...prev };
            delete next.endTime;
            return next;
        });
        closeAllDropdowns();
    };

    // ── Image upload handler ───────────────────────────────────────────────
    // Validates file type and size (max 5MB), stores in state for FormData payload.
    const handleImageChange = (event) => {
        const file = event.target.files?.[0] || null;
        // Guard condition: validate prerequisites before continuing.
        if (file && !file.type.startsWith('image/')) {
            setFieldErrors((prev) => ({ ...prev, eventImage: 'Please upload an image file.' }));
            setEventImage(null);
            return;
        }

        // Guard condition: validate prerequisites before continuing.
        if (file && file.size > 5 * 1024 * 1024) {
            setFieldErrors((prev) => ({ ...prev, eventImage: 'Image must be 5MB or smaller.' }));
            setEventImage(null);
            return;
        }

        setFieldErrors((prev) => {
            // Guard condition: validate prerequisites before continuing.
            if (!prev.eventImage) return prev;
            const next = { ...prev };
            delete next.eventImage;
            return next;
        });
        setEventImage(file);
    };

    // ── CSS helper ────────────────────────────────────────────────────────────
    // Returns className string: base class + 'field-invalid' if field has validation error.
    const getFieldClassName = (fieldName, baseClass = '') => {
        const invalidClass = fieldErrors[fieldName] ? 'field-invalid' : '';
        return [baseClass, invalidClass].filter(Boolean).join(' ');
    };

    // ── URL validation helpers ────────────────────────────────────────────────
    // Validates social media URLs against platform-specific regex patterns.
    const validateSocialMediaUrl = (url, platform) => {
        const trimmed = typeof url === 'string' ? url.trim() : '';
        // Guard condition: validate prerequisites before continuing.
        if (!trimmed) return true; // Empty is valid (optional field)

        const patterns = {
            instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/[\w.]+\/?$/i,
            facebook: /^(https?:\/\/)?(www\.)?facebook\.com\/[\w./-]+\/?$/i,
            youtube: /^(https?:\/\/)?(www\.)?youtube\.com\/(c\/|@)?[\w-]+\/?$/i,
            linkedin: /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company)\/[\w-]+\/?$/i,
            website: /^(https?:\/\/)?(www\.)?[\w.-]+\.[a-z]{2,}\/?/i,
        };

        const pattern = patterns[platform];
        // Guard condition: validate prerequisites before continuing.
        if (!pattern) return false;

        return pattern.test(trimmed);
    };

    // Ensures URL has https:// prefix and validates it's a valid, parseable URL.
    const normalizeUrl = (value) => {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        // Guard condition: validate prerequisites before continuing.
        if (!trimmed) return '';

        const prefixed = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, '')}`;
        try {
            const parsed = new URL(prefixed);
            // Guard condition: validate prerequisites before continuing.
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
            return parsed.toString();
        } catch {
            return '';
        }
    };

    // ── Co-host management ────────────────────────────────────────────────────
    // Normalizes selected co-host data (member or organisation) and updates form.
    const handleCoHostSelect = (entry) => {
        const normalized = {
            userId: String(entry?.entityType === 'organisation' ? entry?.organisationOwnerUserId : entry?.userId || '').trim(),
            entityType: entry?.entityType === 'organisation' ? 'organisation' : 'member',
            organisationId: String(entry?.organisationId || '').trim(),
            displayName: getDiscoverableName(entry),
        };

        // Guard condition: validate prerequisites before continuing.
        if (!normalized.userId) return;

        setSelectedCoHost(normalized);
        setCoHostQuery(normalized.displayName);
        setIsCoHostOpen(false);
    };

    // Clears the currently selected co-host and search query.
    const clearSelectedCoHost = () => {
        setSelectedCoHost(null);
        setCoHostQuery('');
    };

    // Removes a co-host from the accepted co-hosts list by matching key (userId|entityType|orgId).
    const removeAcceptedCoHost = (coHostKey) => {
        const normalizedKey = String(coHostKey || '').trim();
        // Guard condition: validate prerequisites before continuing.
        if (!normalizedKey) return;

        setAcceptedCoHosts((previous) => previous.filter((entry) => entry.key !== normalizedKey));
    };

    // ── Form validation ────────────────────────────────────────────────────
    // Validates all fields client-side before submission.
    // Returns an object mapping field names to error messages.
    const validateForm = () => {
        const nextErrors = {};

        const startDate = form.startDate;
        const startTime = form.startTime;
        const endDate = hasEndDateTime ? form.endDate : '';
        const endTime = form.endTime;

        // Guard condition: validate prerequisites before continuing.
        if (!form.title.trim()) {
            nextErrors.title = 'Title is required.';
        }

        // Guard condition: validate prerequisites before continuing.
        if (!form.description.trim()) {
            nextErrors.description = 'Description is required.';
        }

        // Guard condition: validate prerequisites before continuing.
        if (!startDate) {
            nextErrors.startDate = 'Date is required.';
        }

        // Guard condition: validate prerequisites before continuing.
        if (!startTime) {
            nextErrors.startTime = 'Start time is required.';
        }

        // Guard condition: validate prerequisites before continuing.
        if (!form.address.trim()) {
            nextErrors.address = 'Address is required.';
        }

        // Guard condition: validate prerequisites before continuing.
        if (hasEndDateTime && !endDate) {
            nextErrors.endDate = 'End date is required when end time is enabled.';
        }

        // Guard condition: validate prerequisites before continuing.
        if (hasEndDateTime && !endTime) {
            nextErrors.endTime = 'End time is required when end time is enabled.';
        }

        // Guard condition: validate prerequisites before continuing.
        if (startDate && startTime && endDate && endTime) {
            const start = new Date(`${startDate}T${startTime}`);
            const end = new Date(`${endDate}T${endTime}`);
            // Guard condition: validate prerequisites before continuing.
            if (end <= start) {
                nextErrors.endTime = 'End time must be after start time.';
            }
        }

        // Guard condition: validate prerequisites before continuing.
        if (startDate && endDate && endDate < startDate) {
            nextErrors.endDate = 'End date cannot be before start date.';
        }

        // Guard condition: validate prerequisites before continuing.
        if (!form.freeEvent) {
            const min = Number(form.minPrice);
            const max = Number(form.maxPrice);

            // Guard condition: validate prerequisites before continuing.
            if (Number.isNaN(min) || min < 0) {
                nextErrors.minPrice = 'Minimum price must be a number greater than or equal to 0.';
            }

            // Guard condition: validate prerequisites before continuing.
            if (Number.isNaN(max) || max < 0) {
                nextErrors.maxPrice = 'Maximum price must be a number greater than or equal to 0.';
            }

            // Guard condition: validate prerequisites before continuing.
            if (!Number.isNaN(min) && !Number.isNaN(max)) {
                // Guard condition: validate prerequisites before continuing.
                if (form.fixedPrice && min !== max) {
                    nextErrors.maxPrice = 'For fixed price, both values must match.';
                }

                // Guard condition: validate prerequisites before continuing.
                if (!form.fixedPrice && max < min) {
                    nextErrors.maxPrice = 'Maximum price must be greater than or equal to minimum price.';
                }
            }
        }

        // Guard condition: validate prerequisites before continuing.
        if (form.instagram?.trim() && !validateSocialMediaUrl(form.instagram, 'instagram')) {
            nextErrors.instagram = 'Please enter a valid Instagram URL (e.g., https://www.instagram.com/username).';
        }

        // Guard condition: validate prerequisites before continuing.
        if (form.facebook?.trim() && !validateSocialMediaUrl(form.facebook, 'facebook')) {
            nextErrors.facebook = 'Please enter a valid Facebook URL (e.g., https://www.facebook.com/page).';
        }

        // Guard condition: validate prerequisites before continuing.
        if (form.youtube?.trim() && !validateSocialMediaUrl(form.youtube, 'youtube')) {
            nextErrors.youtube = 'Please enter a valid YouTube URL (e.g., https://www.youtube.com/channel/name).';
        }

        // Guard condition: validate prerequisites before continuing.
        if (form.linkedin?.trim() && !validateSocialMediaUrl(form.linkedin, 'linkedin')) {
            nextErrors.linkedin = 'Please enter a valid LinkedIn URL (e.g., https://www.linkedin.com/in/profile).';
        }

        // Guard condition: validate prerequisites before continuing.
        if (form.website?.trim() && !validateSocialMediaUrl(form.website, 'website')) {
            nextErrors.website = 'Please enter a valid website URL.';
        }

        // Guard condition: validate prerequisites before continuing.
        if (form.ticketLink?.trim() && !normalizeUrl(form.ticketLink)) {
            nextErrors.ticketLink = 'Please enter a valid URL.';
        }

        return nextErrors;
    };

    // Validates form, builds payload, and submits create/update request to API.
    // FR40: All required fields are validated in validateForm() before the payload is built and POSTed to create the event.
    const handleSubmit = async (event) => {
        event.preventDefault();

        // Guard condition: validate prerequisites before continuing.
        if (!canCreateEvent) {
            setFormMessage(isEditingEvent ? 'Only organisers and admins can edit events.' : 'Only organisers and admins can create events.');
            return;
        }

        const validationErrors = validateForm();
        setFieldErrors(validationErrors);
        setFormMessage('');

        // Guard condition: validate prerequisites before continuing.
        if (Object.keys(validationErrors).length > 0) {
            setFormMessage('Please fix the highlighted fields before submitting.');

            // Move the user to the first invalid input so submit never appears unresponsive.
            const [firstErrorFieldName] = Object.keys(validationErrors);
            const firstErrorInput = document.querySelector(`[name="${firstErrorFieldName}"]`);
            // Guard condition: validate prerequisites before continuing.
            if (firstErrorInput && typeof firstErrorInput.focus === 'function') {
                firstErrorInput.focus();
            }
            // Guard condition: validate prerequisites before continuing.
            if (firstErrorInput && typeof firstErrorInput.scrollIntoView === 'function') {
                firstErrorInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            return;
        }

        try {
            setIsSubmitting(true);
            const payload = new FormData();
            payload.append('eventType', form.eventType);
            // FR32: event title appended to FormData payload.
            payload.append('title', form.title.trim());
            // FR33: event description appended to FormData payload.
            payload.append('description', form.description.trim());
            payload.append('genres', JSON.stringify(form.genres));
            payload.append('musicFormat', form.musicFormat);
            // FR35: start/end date and time fields appended to FormData payload.
            payload.append('startDate', form.startDate);
            payload.append('startTime', form.startTime);
            payload.append('endDate', hasEndDateTime ? form.endDate : '');
            payload.append('endTime', hasEndDateTime ? form.endTime : '');
            // FR36: venue, address, city fields provide location information for the event.
            payload.append('venue', form.venue.trim());
            payload.append('address', form.address.trim());
            payload.append('city', form.city.trim());
            // FR37: ticket type, pricing, and ticket link fields supply ticket information.
            payload.append('ticketType', form.ticketType);
            payload.append('freeEvent', String(form.freeEvent));
            payload.append('minPrice', form.freeEvent ? '0' : String(form.minPrice || '0'));
            payload.append('maxPrice', form.freeEvent ? '0' : String((form.fixedPrice ? form.minPrice : form.maxPrice) || '0'));
            payload.append('fixedPrice', String(form.fixedPrice));
            payload.append('currency', form.currency);
            payload.append('ticketLink', form.ticketLink.trim());
            payload.append('allowResell', form.allowResell);
            payload.append('resellCondition', form.resellCondition);
            // FR38: social link fields (instagram, facebook, youtube, linkedin, website) appended to payload.
            payload.append('instagram', form.instagram.trim());
            payload.append('facebook', form.facebook.trim());
            payload.append('youtube', form.youtube.trim());
            payload.append('linkedin', form.linkedin.trim());
            payload.append('website', form.website.trim());
            payload.append('publisherType', publisherType);
            // Guard condition: validate prerequisites before continuing.
            if (publisherType === 'organisation' && userOrganisation?.id) {
                payload.append('publisherOrganisationId', userOrganisation.id);
            }
            // FR39: co-host fields appended only when user has permission to manage co-hosts.
            // Guard condition: validate prerequisites before continuing.
            if (canManageCoHosts) {
                payload.append('coHostUserId', selectedCoHost?.userId || '');
                payload.append('coHostType', selectedCoHost?.entityType || '');
                payload.append('coHostOrganisationId', selectedCoHost?.organisationId || '');
                payload.append('coHostDisplayName', selectedCoHost?.displayName || '');
            }

            // Guard condition: validate prerequisites before continuing.
            if (isEditingEvent && canManageCoHosts) {
                const currentAcceptedKeys = new Set(
                    acceptedCoHosts
                        .map((entry) => String(entry?.key || '').trim())
                        .filter(Boolean)
                );
                const removedCoHostKeys = initialAcceptedCoHostKeys.filter((key) => !currentAcceptedKeys.has(key));
                payload.append('removedCoHostKeys', JSON.stringify(removedCoHostKeys));
            }

            // FR34: event image file appended to FormData when user has upload permission.
            // Guard condition: validate prerequisites before continuing.
            if (eventImage && canUploadEventImage) {
                payload.append('eventImage', eventImage);
            }

            // FR40: POST sends the complete event to the backend; PATCH updates an existing event (FR41).
            const endpoint = isEditingEvent
                ? `${API_URL}/api/calendar/events/${encodeURIComponent(eventId)}`
                : `${API_URL}/api/calendar/events`;
            const method = isEditingEvent ? 'PATCH' : 'POST';

            const response = await fetch(endpoint, {
                method,
                credentials: 'include',
                body: payload,
            });

            const data = await response.json();
            // Guard condition: validate prerequisites before continuing.
            if (!response.ok || !data.success) {
                throw new Error(data.message || (isEditingEvent ? 'Unable to update event.' : 'Unable to create event.'));
            }

            const inviteWarning = typeof data.coHostInviteWarning === 'string' ? data.coHostInviteWarning.trim() : '';
            setFormMessage(
                inviteWarning
                    ? `${isEditingEvent ? 'Event updated.' : 'Event created.'} Published as ${selectedPublisherName}. ${inviteWarning}`
                    : `${isEditingEvent ? 'Event updated successfully.' : 'Event created successfully.'} Published as ${selectedPublisherName}. Redirecting...`
            );
            setForm(initialFormState);
            setHasEndDateTime(false);
            setEventImage(null);
            setEventImagePreview('');
            setSelectedCoHost(null);
            setCoHostQuery('');

            // Guard condition: validate prerequisites before continuing.
            if (!isEditingEvent && data.activityLine) {
                setAuthenticatedUser((previous) => {
                    // Guard condition: validate prerequisites before continuing.
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
            setFormMessage(submitError.message || (isEditingEvent ? 'Unable to update event.' : 'Unable to create event.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section
            className="calendar-create-page"
            onMouseDown={(event) => {
                // Guard condition: validate prerequisites before continuing.
                if (formContainerRef.current && !formContainerRef.current.contains(event.target)) {
                    closeAllDropdowns();
                }
            }}
        >
            <h1 className="calendar-create-title">{isEditingEvent ? 'Edit Event' : 'Create Event'}</h1>

            <form
                className="calendar-create-card"
                noValidate
                onSubmit={handleSubmit}
                onMouseDown={(event) => {
                    // Guard condition: validate prerequisites before continuing.
                    if (event.target === event.currentTarget) {
                        closeAllDropdowns();
                    }
                }}
                ref={formContainerRef}
            >
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
                                maxLength={80}
                                className={getFieldClassName('title')}
                                required
                            />
                            <small>{titleCount}/80 characters</small>
                            {fieldErrors.title ? <small className="field-error">{fieldErrors.title}</small> : null}
                        </label>

                        <label className="form-field">
                            <span>Description <strong>*</strong></span>
                            <textarea
                                name="description"
                                value={form.description}
                                onChange={handleFieldChange}
                                maxLength={2000}
                                className={getFieldClassName('description')}
                                required
                            />
                            <small>{descriptionCount}/2000 characters</small>
                            {fieldErrors.description ? <small className="field-error">{fieldErrors.description}</small> : null}
                        </label>
                    </div>

                    <div className="field-grid two-column details-filters">
                        <div className="form-field details-dropdown details-genre-dropdown">
                            <span>Genre</span>
                            <button
                                type="button"
                                className={`details-dropdown-trigger ${isGenreOpen ? 'open' : ''}`}
                                onClick={() => {
                                    // Guard condition: validate prerequisites before continuing.
                                    if (isGenreOpen) {
                                        closeAllDropdowns();
                                        return;
                                    }

                                    openOnlyDropdown('genre');
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
                                    // Guard condition: validate prerequisites before continuing.
                                    if (isMusicFormatOpen) {
                                        closeAllDropdowns();
                                        return;
                                    }

                                    openOnlyDropdown('music');
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
                        <div className="form-field details-dropdown hosted-by-dropdown">
                            <span>Publish under</span>
                            <div className="publisher-dropdown-shell">
                                <button
                                    type="button"
                                    className={`details-dropdown-trigger ${isPublisherTypeOpen ? 'open' : ''}`}
                                    onClick={() => {
                                        // Guard condition: validate prerequisites before continuing.
                                        if (isPublisherTypeOpen) {
                                            closeAllDropdowns();
                                            return;
                                        }

                                        openOnlyDropdown('publisher');
                                    }}
                                    aria-expanded={isPublisherTypeOpen}
                                    aria-haspopup="listbox"
                                >
                                    <span>{selectedPublisherName}</span>
                                    <span className="details-dropdown-caret">▾</span>
                                </button>

                                {isPublisherTypeOpen && (
                                    <div className="details-dropdown-panel publisher-dropdown-panel" role="listbox" aria-label="Select publisher">
                                        <div className="currency-dropdown-options">
                                            <label className={`currency-option ${publisherType === 'member' ? 'active' : ''}`}>
                                                <input
                                                    type="radio"
                                                    name="publisherType"
                                                    value="member"
                                                    checked={publisherType === 'member'}
                                                    onChange={() => {
                                                        setPublisherType('member');
                                                        closeAllDropdowns();
                                                    }}
                                                />
                                                <span>{hostName}</span>
                                            </label>

                                            {userOrganisation && (
                                                <label className={`currency-option ${publisherType === 'organisation' ? 'active' : ''}`}>
                                                    <input
                                                        type="radio"
                                                        name="publisherType"
                                                        value="organisation"
                                                        checked={publisherType === 'organisation'}
                                                        onChange={() => {
                                                            setPublisherType('organisation');
                                                            closeAllDropdowns();
                                                        }}
                                                    />
                                                    <span>{userOrganisation.organisationName}</span>
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <small className="publish-under-helper">Published as {selectedPublisherName}</small>
                        </div>

                        {canUploadEventImage ? (
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
                        ) : (
                            <div className="form-field upload-field">
                                <span>Image</span>
                                <p className="contact-copy">Admin accounts use the default event image.</p>
                            </div>
                        )}
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
                                className={getFieldClassName('startDate')}
                                required
                            />
                            {fieldErrors.startDate ? <small className="field-error">{fieldErrors.startDate}</small> : null}
                        </label>

                        <div className="form-field address-autocomplete-field date-time-dropdown-field">
                            <span>Start <strong>*</strong></span>
                            <div className={`date-time-dropdown-control ${isStartTimeOpen ? 'open' : ''}`}>
                                <input
                                    type="text"
                                    name="startTime"
                                    value={form.startTime}
                                    placeholder="Select start time"
                                    readOnly
                                    autoComplete="off"
                                    className={getFieldClassName('startTime', 'date-time-dropdown-input')}
                                    onClick={() => {
                                        // Guard condition: validate prerequisites before continuing.
                                        if (isStartTimeOpen) {
                                            closeAllDropdowns();
                                            return;
                                        }

                                        openOnlyDropdown('startTime');
                                    }}
                                    onFocus={() => {
                                        openOnlyDropdown('startTime');
                                    }}
                                    role="combobox"
                                    aria-expanded={isStartTimeOpen}
                                    aria-controls="start-time-options"
                                    aria-autocomplete="list"
                                    required
                                />
                                <button
                                    type="button"
                                    className="date-time-dropdown-caret-button"
                                    onClick={() => {
                                        // Guard condition: validate prerequisites before continuing.
                                        if (isStartTimeOpen) {
                                            closeAllDropdowns();
                                            return;
                                        }

                                        openOnlyDropdown('startTime');
                                    }}
                                    aria-label="Toggle start time options"
                                >
                                    <span className="date-time-dropdown-caret-icon">▾</span>
                                </button>
                            </div>

                            {isStartTimeOpen ? (
                                <div className="address-autocomplete-dropdown date-time-options-dropdown" id="start-time-options" role="listbox">
                                    {TIME_OPTIONS.map((time) => {
                                        const isHighlighted = form.startTime === time;
                                        return (
                                            <button
                                                key={time}
                                                type="button"
                                                role="option"
                                                aria-selected={isHighlighted}
                                                className={`address-autocomplete-option date-time-option ${isHighlighted ? 'highlighted' : ''}`}
                                                onMouseDown={(mouseEvent) => {
                                                    mouseEvent.preventDefault();
                                                    handleStartTimeSelect(time);
                                                }}
                                            >
                                                <span className="address-option-main">{time}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : null}
                            {fieldErrors.startTime ? <small className="field-error">{fieldErrors.startTime}</small> : null}
                        </div>

                        {hasEndDateTime ? (
                            <>
                                <label className="form-field">
                                    <span>End date</span>
                                    <input
                                        type="date"
                                        name="endDate"
                                        value={form.endDate}
                                        onChange={handleFieldChange}
                                        min={form.startDate}
                                        className={getFieldClassName('endDate')}
                                    />
                                    {fieldErrors.endDate ? <small className="field-error">{fieldErrors.endDate}</small> : null}
                                </label>

                                <div className="form-field address-autocomplete-field date-time-dropdown-field">
                                    <span>End time</span>
                                    <div className={`date-time-dropdown-control ${isEndTimeOpen ? 'open' : ''}`}>
                                        <input
                                            type="text"
                                            name="endTime"
                                            value={form.endTime}
                                            placeholder="Select end time"
                                            readOnly
                                            autoComplete="off"
                                            className={getFieldClassName('endTime', 'date-time-dropdown-input')}
                                            onClick={() => {
                                                // Guard condition: validate prerequisites before continuing.
                                                if (isEndTimeOpen) {
                                                    closeAllDropdowns();
                                                    return;
                                                }

                                                openOnlyDropdown('endTime');
                                            }}
                                            onFocus={() => {
                                                openOnlyDropdown('endTime');
                                            }}
                                            role="combobox"
                                            aria-expanded={isEndTimeOpen}
                                            aria-controls="end-time-options"
                                            aria-autocomplete="list"
                                        />
                                        <button
                                            type="button"
                                            className="date-time-dropdown-caret-button"
                                            onClick={() => {
                                                // Guard condition: validate prerequisites before continuing.
                                                if (isEndTimeOpen) {
                                                    closeAllDropdowns();
                                                    return;
                                                }

                                                openOnlyDropdown('endTime');
                                            }}
                                            aria-label="Toggle end time options"
                                        >
                                            <span className="date-time-dropdown-caret-icon">▾</span>
                                        </button>
                                    </div>

                                    {isEndTimeOpen ? (
                                        <div className="address-autocomplete-dropdown date-time-options-dropdown" id="end-time-options" role="listbox">
                                            {endTimeOptions.length === 0 ? (
                                                <div className="no-time-option">No valid times available.</div>
                                            ) : null}
                                            {endTimeOptions.map((time) => {
                                                const isHighlighted = form.endTime === time;
                                                return (
                                                    <button
                                                        key={time}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={isHighlighted}
                                                        className={`address-autocomplete-option date-time-option ${isHighlighted ? 'highlighted' : ''}`}
                                                        onMouseDown={(mouseEvent) => {
                                                            mouseEvent.preventDefault();
                                                            handleEndTimeSelect(time);
                                                        }}
                                                    >
                                                        <span className="address-option-main">{time}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                    {fieldErrors.endTime ? <small className="field-error">{fieldErrors.endTime}</small> : null}
                                </div>
                            </>
                        ) : null}
                    </div>

                    <button
                        type="button"
                        className="date-time-toggle"
                        onClick={() => {
                            // Guard condition: validate prerequisites before continuing.
                            if (hasEndDateTime) {
                                setHasEndDateTime(false);
                                closeAllDropdowns();
                                setForm((prev) => ({
                                    ...prev,
                                    endDate: '',
                                    endTime: '',
                                }));
                                setFieldErrors((prev) => {
                                    // Guard condition: validate prerequisites before continuing.
                                    if (!prev.endDate && !prev.endTime) return prev;
                                    const next = { ...prev };
                                    delete next.endDate;
                                    delete next.endTime;
                                    return next;
                                });
                                return;
                            }

                            setHasEndDateTime(true);
                            setForm((prev) => ({
                                ...prev,
                                endDate: prev.endDate || prev.startDate,
                            }));
                        }}
                    >
                        {hasEndDateTime ? '- Remove end date and time' : '+ Add end date and time'}
                    </button>
                </section>

                <section className="form-section">
                    <h2>Location</h2>
                    <div className="field-grid two-column">
                        <label className="form-field">
                            <span>Venue</span>
                            <input type="text" name="venue" value={form.venue} onChange={handleFieldChange} />
                        </label>

                        <label className="form-field address-autocomplete-field" ref={addressAutocompleteRef}>
                            <span>Address <strong>*</strong></span>
                            <input
                                type="text"
                                name="address"
                                value={form.address}
                                onChange={handleAddressChange}
                                onFocus={handleAddressFocus}
                                onKeyDown={handleAddressKeyDown}
                                autoComplete="off"
                                placeholder="Search address"
                                role="combobox"
                                aria-expanded={isAddressOpen && addressSuggestions.length > 0}
                                aria-controls="address-autocomplete-list"
                                aria-autocomplete="list"
                                className={getFieldClassName('address')}
                                required
                            />
                            {isAddressLoading ? <small>Searching places...</small> : null}
                            {isAddressOpen && addressSuggestions.length > 0 ? (
                                <div className="address-autocomplete-dropdown" id="address-autocomplete-list" role="listbox">
                                    {addressSuggestions.map((suggestion, index) => {
                                        const isHighlighted = index === highlightedAddressIndex;

                                        return (
                                            <button
                                                key={suggestion.id || `${suggestion.placeId || 'place'}-${index}`}
                                                type="button"
                                                role="option"
                                                aria-selected={isHighlighted}
                                                className={`address-autocomplete-option ${isHighlighted ? 'highlighted' : ''}`}
                                                onMouseEnter={() => setHighlightedAddressIndex(index)}
                                                onMouseDown={(mouseEvent) => {
                                                    mouseEvent.preventDefault();
                                                    applyAddressSuggestion(suggestion);
                                                }}
                                            >
                                                <span className="address-option-main">{suggestion.primaryText || suggestion.description}</span>
                                                {suggestion.secondaryText ? (
                                                    <span className="address-option-secondary">{suggestion.secondaryText}</span>
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : null}
                            {addressError ? <small className="field-error">{addressError}</small> : null}
                            {fieldErrors.address ? <small className="field-error">{fieldErrors.address}</small> : null}
                        </label>
                    </div>

                </section>

                <section className="form-section">
                    <h2>Tickets</h2>

                    <div className="field-grid tickets-grid details-filters">
                        <div className="form-field details-dropdown details-ticket-type-dropdown">
                            <span>Select Type</span>
                            <button
                                type="button"
                                className={`details-dropdown-trigger ${isTicketTypeOpen ? 'open' : ''}`}
                                onClick={() => {
                                    // Guard condition: validate prerequisites before continuing.
                                    if (isTicketTypeOpen) {
                                        closeAllDropdowns();
                                        return;
                                    }

                                    openOnlyDropdown('ticket');
                                }}
                                aria-expanded={isTicketTypeOpen}
                                aria-haspopup="listbox"
                            >
                                <span>{(form.freeEvent ? FREE_TICKET_TYPE_LABELS : PAID_TICKET_TYPE_LABELS)[form.ticketType] || PAID_TICKET_TYPE_LABELS.prepaid}</span>
                                <span className="details-dropdown-caret">▾</span>
                            </button>

                            {isTicketTypeOpen && (
                                <div className="details-dropdown-panel ticket-type-dropdown-panel" role="listbox" aria-label="Select ticket type">
                                    <div className="ticket-type-dropdown-options">
                                        <label className={`ticket-type-option ${form.ticketType === 'prepaid' ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="ticketType"
                                                value="prepaid"
                                                checked={form.ticketType === 'prepaid'}
                                                onChange={() => handleTicketTypeSelect('prepaid')}
                                            />
                                            <span>{form.freeEvent ? FREE_TICKET_TYPE_LABELS.prepaid : PAID_TICKET_TYPE_LABELS.prepaid}</span>
                                        </label>
                                        <label className={`ticket-type-option ${form.ticketType === 'door' ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="ticketType"
                                                value="door"
                                                checked={form.ticketType === 'door'}
                                                onChange={() => handleTicketTypeSelect('door')}
                                            />
                                            <span>{form.freeEvent ? FREE_TICKET_TYPE_LABELS.door : PAID_TICKET_TYPE_LABELS.door}</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={`ticket-price-row ${form.fixedPrice ? 'single-price' : ''}`}>
                            <label className="form-field ticket-min-field">
                                <span>Price <strong>*</strong></span>
                                <input
                                    type="number"
                                    name="minPrice"
                                    placeholder={form.fixedPrice ? 'Price' : 'Min'}
                                    min="0"
                                    step="0.01"
                                    value={form.minPrice}
                                    onChange={handleFieldChange}
                                    disabled={form.freeEvent}
                                    className={getFieldClassName('minPrice')}
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
                                        step="0.01"
                                        value={form.maxPrice}
                                        onChange={handleFieldChange}
                                        disabled={form.freeEvent}
                                        className={getFieldClassName('maxPrice')}
                                        required={!form.freeEvent}
                                    />
                                    {fieldErrors.maxPrice ? <small className="field-error">{fieldErrors.maxPrice}</small> : null}
                                </label>
                            )}

                            <div className="form-field details-dropdown details-currency-dropdown">
                                <span>Currency <strong>*</strong></span>
                                <button
                                    type="button"
                                    className={`details-dropdown-trigger ${isCurrencyOpen ? 'open' : ''}`}
                                    onClick={() => {
                                        // Guard condition: validate prerequisites before continuing.
                                        if (isCurrencyOpen) {
                                            closeAllDropdowns();
                                            return;
                                        }

                                        openOnlyDropdown('currency');
                                    }}
                                    aria-expanded={isCurrencyOpen}
                                    aria-haspopup="listbox"
                                >
                                    <span>{form.currency}</span>
                                    <span className="details-dropdown-caret">▾</span>
                                </button>

                                {isCurrencyOpen && (
                                    <div className="details-dropdown-panel currency-dropdown-panel" role="listbox" aria-label="Select currency">
                                        <div className="currency-dropdown-options">
                                            {currencyOptions.map((currency) => (
                                                <label key={currency} className={`currency-option ${form.currency === currency ? 'active' : ''}`}>
                                                    <input
                                                        type="radio"
                                                        name="currency"
                                                        value={currency}
                                                        checked={form.currency === currency}
                                                        onChange={() => handleCurrencySelect(currency)}
                                                    />
                                                    <span>{currency}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="inline-check ticket-free-check">
                            <input type="checkbox" name="freeEvent" checked={form.freeEvent} onChange={handleFieldChange} />
                            <span>This event is free</span>
                        </div>

                        <div className="inline-check fixed-price-check">
                            <input type="checkbox" name="fixedPrice" checked={form.fixedPrice} onChange={handleFieldChange} disabled={form.freeEvent} />
                            <span>Fixed price</span>
                        </div>

                        <p className="tickets-note">
                            Note: If you are offering discounted ticket (e.g., student discount) please specify the conditions in the event description.
                        </p>
                    </div>

                    <div className="field-grid resale-grid">
                        <label className="form-field resale-link-field">
                            <span>Link to "Get Ticket"</span>
                            <input type="url" name="ticketLink" value={form.ticketLink} onChange={handleFieldChange} placeholder="https://" className={getFieldClassName('ticketLink')} />
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
                    <h2>Online Links</h2>
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

                {canManageCoHosts ? (
                    <section className="form-section">
                        <h2>Contacts (co-host)</h2>
                        <p className="contact-copy">
                            You are automatically included as the main contact. Add more users who can be contacted regarding the event.
                        </p>

                        {isEditingEvent && acceptedCoHosts.length > 0 ? (
                            <div className="cohost-existing-list" aria-label="Accepted co-host contacts">
                                {acceptedCoHosts.map((entry) => (
                                    <div key={entry.key} className="cohost-existing-item">
                                        <span className="cohost-existing-name">
                                            {entry.displayName}
                                            {entry.entityType === 'organisation' ? ' (Organisation)' : ''}
                                        </span>
                                        <button
                                            type="button"
                                            className="btn-secondary cohost-remove-btn"
                                            onClick={() => removeAcceptedCoHost(entry.key)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        <label className="form-field cohost-field">
                            <span>Add co-hosts</span>
                            <input
                                type="text"
                                value={coHostQuery}
                                onChange={(event) => {
                                    setCoHostQuery(event.target.value);
                                    openOnlyDropdown('cohost');
                                }}
                                onFocus={() => openOnlyDropdown('cohost')}
                                placeholder="Search by name or email"
                            />
                        </label>

                        {isCoHostOpen ? (
                            <div className="cohost-dropdown-menu" role="listbox" aria-label="Co-host contacts">
                                {filteredCoHostCandidates.length === 0 ? (
                                    <p className="cohost-empty">No contacts found.</p>
                                ) : (
                                    filteredCoHostCandidates.map((entry) => {
                                        const optionLabel = getDiscoverableName(entry);
                                        const optionUserId = String(entry?.entityType === 'organisation' ? entry?.organisationOwnerUserId : entry?.userId || '');
                                        const isSelected = selectedCoHost
                                            && optionUserId === selectedCoHost.userId
                                            && (entry?.entityType === 'organisation' ? 'organisation' : 'member') === selectedCoHost.entityType;

                                        return (
                                            <button
                                                key={`${entry?.entityType || 'member'}-${String(entry?.userId || entry?.organisationId || optionLabel)}`}
                                                type="button"
                                                className={`cohost-dropdown-option ${isSelected ? 'selected' : ''}`}
                                                onClick={() => handleCoHostSelect(entry)}
                                            >
                                                {optionLabel}
                                                {entry?.entityType === 'organisation' ? ' (Organisation)' : ''}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        ) : null}

                        {selectedCoHost ? (
                            <div className="cohost-selected-row">
                                <small className="cohost-help">The selected contact will be notified, if they approve being co-host, their contact will be shown on the event overview.</small>
                                <button type="button" className="btn-secondary cohost-clear-btn" onClick={clearSelectedCoHost}>Clear</button>
                            </div>
                        ) : null}

                        <small className="cohost-help">Co-hosts can accept or decline once you've published your event.</small>
                    </section>
                ) : null}

                <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={isSubmitting || isAuthLoading || !canCreateEvent || (isEditingEvent && isLoadingEditEvent)}>
                        {isSubmitting ? (isEditingEvent ? 'Saving...' : 'Creating...') : (isEditingEvent ? 'Save changes' : 'Create event')}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard/calendar')}>
                        Cancel
                    </button>
                </div>

                {!isAuthLoading && !canCreateEvent ? (
                    <p className="calendar-create-message">
                        Your account role cannot publish events yet.
                    </p>
                ) : null}
            </form>
        </section>
    );
}

