// CSRF Token Management Utility
let csrfToken = null;

/**
 * Fetches the CSRF token from the server
 * @returns {Promise<string>} The CSRF token
 */
export const fetchCsrfToken = async () => {
    try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${API_URL}/api/csrf-token`, {
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
    const method = (options.method || 'GET').toUpperCase();
    
    // Only add CSRF token for state-changing methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const token = await getCsrfToken();
        
        options.headers = {
            ...options.headers,
            'x-csrf-token': token,
        };
    }
    
    // Always include credentials for cookie-based auth
    options.credentials = 'include';
    
    const response = await fetch(url, options);
    
    // If we get a 403 with CSRF error, try refreshing the token and retry once
    if (response.status === 403) {
        const data = await response.clone().json().catch(() => ({}));
        if (data.message?.toLowerCase().includes('csrf')) {
            // Clear and refetch token
            clearCsrfToken();
            const newToken = await fetchCsrfToken();
            
            options.headers = {
                ...options.headers,
                'x-csrf-token': newToken,
            };
            
            return fetch(url, options);
        }
    }
    
    return response;
};