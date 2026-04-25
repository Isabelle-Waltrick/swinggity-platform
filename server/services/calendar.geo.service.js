import {
    GEOAPIFY_AUTOCOMPLETE_URL,
    GEOAPIFY_REVERSE_URL,
} from "../constants/calendar.constants.js";
import {
    asTrimmedString,
    resolveCurrencyFromCountryCode,
    resolveGeoapifyApiKey,
} from "../validators/calendar.validators.js";

export const autocompletePlacesService = async ({ input, country }) => {
    const apiKey = resolveGeoapifyApiKey();
    if (!apiKey) {
        return {
            status: 500,
            body: {
                success: false,
                message: "Geoapify autocomplete is not configured on the server.",
            },
        };
    }

    const normalizedInput = asTrimmedString(input).slice(0, 120);
    if (normalizedInput.length < 2) {
        return { status: 200, body: { success: true, suggestions: [] } };
    }

    const requestedCountry = asTrimmedString(country).toLowerCase();
    const countryCode = /^[a-z]{2}$/.test(requestedCountry) ? requestedCountry : "";

    const query = new URLSearchParams({
        text: normalizedInput,
        apiKey,
        format: "json",
        limit: "8",
    });

    if (countryCode) {
        query.set("filter", `countrycode:${countryCode}`);
    }

    const response = await fetch(`${GEOAPIFY_AUTOCOMPLETE_URL}?${query.toString()}`);
    if (!response.ok) {
        return {
            status: 502,
            body: {
                success: false,
                message: "Unable to reach Geoapify autocomplete service.",
            },
        };
    }

    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];

    const suggestions = results
        .map((item, index) => {
            const formatted = asTrimmedString(item?.formatted);
            const line1 = asTrimmedString(item?.address_line1) || asTrimmedString(item?.name);
            const line2 = asTrimmedString(item?.address_line2);
            const placeId = asTrimmedString(item?.place_id);
            const itemCountryCode = asTrimmedString(item?.country_code).toLowerCase();
            const currency = resolveCurrencyFromCountryCode(itemCountryCode);
            const city = asTrimmedString(item?.city)
                || asTrimmedString(item?.town)
                || asTrimmedString(item?.village)
                || asTrimmedString(item?.county)
                || asTrimmedString(item?.state);

            return {
                id: placeId || `${formatted}-${index}`,
                placeId,
                primaryText: line1 || formatted,
                secondaryText: line2,
                description: formatted || [line1, line2].filter(Boolean).join(", "),
                city,
                countryCode: itemCountryCode,
                currency,
            };
        })
        .filter((item) => item.description);

    return { status: 200, body: { success: true, suggestions } };
};

export const autocompleteCitiesService = async ({ input }) => {
    const apiKey = resolveGeoapifyApiKey();
    if (!apiKey) {
        return {
            status: 500,
            body: {
                success: false,
                message: "Geoapify autocomplete is not configured on the server.",
            },
        };
    }

    const normalizedInput = asTrimmedString(input).slice(0, 120);
    if (normalizedInput.length < 1) {
        return { status: 200, body: { success: true, suggestions: [] } };
    }

    const query = new URLSearchParams({
        text: normalizedInput,
        apiKey,
        format: "json",
        limit: "12",
        type: "city",
    });

    const response = await fetch(`${GEOAPIFY_AUTOCOMPLETE_URL}?${query.toString()}`);
    if (!response.ok) {
        return {
            status: 502,
            body: {
                success: false,
                message: "Unable to reach Geoapify city service.",
            },
        };
    }

    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];

    const suggestions = results
        .map((item, index) => {
            const city = asTrimmedString(item?.city)
                || asTrimmedString(item?.town)
                || asTrimmedString(item?.village)
                || asTrimmedString(item?.county)
                || asTrimmedString(item?.state)
                || asTrimmedString(item?.name);
            const country = asTrimmedString(item?.country);
            const formatted = asTrimmedString(item?.formatted);
            const placeId = asTrimmedString(item?.place_id);
            const lat = Number(item?.lat);
            const lon = Number(item?.lon);

            return {
                id: placeId || `${city}-${country}-${index}`,
                placeId,
                city,
                country,
                description: [city, country].filter(Boolean).join(", ") || formatted,
                lat: Number.isFinite(lat) ? lat : null,
                lon: Number.isFinite(lon) ? lon : null,
            };
        })
        .filter((item) => item.city && item.description)
        .filter((item, index, items) => (
            items.findIndex((other) => (
                other.city.toLowerCase() === item.city.toLowerCase()
                && other.country.toLowerCase() === item.country.toLowerCase()
            )) === index
        ));

    return { status: 200, body: { success: true, suggestions } };
};

export const reverseCityLookupService = async ({ lat, lon }) => {
    const apiKey = resolveGeoapifyApiKey();
    if (!apiKey) {
        return {
            status: 500,
            body: {
                success: false,
                message: "Geoapify reverse geocoding is not configured on the server.",
            },
        };
    }

    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return { status: 400, body: { success: false, message: "Invalid coordinates." } };
    }

    const query = new URLSearchParams({
        apiKey,
        format: "json",
        lat: String(latitude),
        lon: String(longitude),
    });

    const response = await fetch(`${GEOAPIFY_REVERSE_URL}?${query.toString()}`);
    if (!response.ok) {
        return {
            status: 502,
            body: {
                success: false,
                message: "Unable to reach Geoapify reverse geocoding service.",
            },
        };
    }

    const payload = await response.json();
    const firstResult = Array.isArray(payload?.results) ? payload.results[0] : null;
    const city = asTrimmedString(firstResult?.city)
        || asTrimmedString(firstResult?.town)
        || asTrimmedString(firstResult?.village)
        || asTrimmedString(firstResult?.county)
        || asTrimmedString(firstResult?.state)
        || asTrimmedString(firstResult?.name);
    const country = asTrimmedString(firstResult?.country);

    return {
        status: 200,
        body: {
            success: true,
            city,
            country,
            description: [city, country].filter(Boolean).join(", "),
        },
    };
};
