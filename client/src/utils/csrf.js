// CSRF Token Management Utility
let csrfToken = null;
let interceptorInstalled = false;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const originalFetch = window.fetch.bind(window);

const getAbsoluteUrl = (input) => {
    try {
        if (typeof input === 'string') {
            return new URL(input, window.location.origin);
        }
        if (input instanceof URL) {
            return input;
        }
        if (input instanceof Request) {
            return new URL(input.url);
        }
    } catch {
        return null;
    }
    return null;
};

const isApiRequest = (input) => {
    const requestUrl = getAbsoluteUrl(input);
    if (!requestUrl) {
        return false;
    }

    const apiBaseUrl = new URL(API_URL, window.location.origin);
    if (requestUrl.origin !== apiBaseUrl.origin) {
        return false;
    }

    const basePath = apiBaseUrl.pathname.replace(/\/$/, '');
    if (!basePath || basePath === '') {
        return true;
    }

    return requestUrl.pathname.startsWith(basePath);
};

/**
 * Fetches the CSRF token from the server
 * @returns {Promise<string>} The CSRF token
 */
export const fetchCsrfToken = async () => {
    try {
        const response = await originalFetch(`${API_URL}/api/csrf-token`, {
            method: 'GET',
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Failed to fetch CSRF token');
        }

        const data = await response.json();
        csrfToken = data.csrfToken;
        return csrfToken;
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
        throw error;
    }
};

/**
 * Gets the current CSRF token, fetching a new one if necessary
 * @returns {Promise<string>} The CSRF token
 */
export const getCsrfToken = async () => {
    if (!csrfToken) {
        return await fetchCsrfToken();
    }
    return csrfToken;
};

/**
 * Clears the stored CSRF token (useful after logout)
 */
export const clearCsrfToken = () => {
    csrfToken = null;
};

/**
 * Makes a fetch request with CSRF token included
 * Automatically includes the CSRF token for POST, PUT, DELETE, PATCH methods
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} The fetch response
 */
export const csrfFetch = async (url, options = {}) => {
    const requestOptions = { ...options };
    const method = (requestOptions.method || 'GET').toUpperCase();
    const shouldAttachCsrf = isApiRequest(url) && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    const shouldIncludeCredentials = isApiRequest(url);

    // Only add CSRF token for state-changing methods
    if (shouldAttachCsrf) {
        const token = await getCsrfToken();

        requestOptions.headers = {
            ...requestOptions.headers,
            'x-csrf-token': token,
        };
    }

    if (shouldIncludeCredentials && !requestOptions.credentials) {
        requestOptions.credentials = 'include';
    }

    const response = await originalFetch(url, requestOptions);

    // If we get a 403 with CSRF error, try refreshing the token and retry once
    if (shouldAttachCsrf && response.status === 403) {
        const data = await response.clone().json().catch(() => ({}));
        if (data.message?.toLowerCase().includes('csrf')) {
            // Clear and refetch token
            clearCsrfToken();
            const newToken = await fetchCsrfToken();

            requestOptions.headers = {
                ...requestOptions.headers,
                'x-csrf-token': newToken,
            };

            return originalFetch(url, requestOptions);
        }
    }

    return response;
};

export const installCsrfFetchInterceptor = () => {
    if (interceptorInstalled) {
        return;
    }

    window.fetch = (input, init) => csrfFetch(input, init);
    interceptorInstalled = true;
};