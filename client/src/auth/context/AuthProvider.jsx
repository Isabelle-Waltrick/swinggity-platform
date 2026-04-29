import { useState, useEffect } from 'react';
import { AuthContext } from './useAuth';
import { clearCsrfToken } from '../../utils/csrf';

/**
 * AuthProvider:
 * Centralizes authenticated user/session state and exposes auth/profile actions
 * through React context so any child component can consume them via useAuth.
 */
export function AuthProvider({ children }) {
    // Core auth session state used across the application.
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // On first mount, verify whether an existing cookie-backed session is still valid.
    useEffect(() => {
        const verifyAuth = async () => {
            try {
                // Use configured backend API URL, with localhost fallback for local development.
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const response = await fetch(`${API_URL}/api/auth/verify`, {
                    // Include cookies so the backend can validate current session token.
                    credentials: 'include',
                });

                // Successful verification rehydrates user state and marks the session authenticated.
                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                    setIsAuthenticated(true);
                }
            } catch (err) {
                // Network or server failures during startup verification should not crash the app.
                console.error('Auth verification failed:', err);
            } finally {
                // End initial loading state regardless of verification outcome.
                setIsLoading(false);
            }
        };

        // Fire one-time session verification on provider mount.
        verifyAuth();
    }, []);

    // Called after successful login/register flows to hydrate auth state immediately.
    const login = (userData) => {
        setUser(userData);
        setIsAuthenticated(true);
    };

    // Flexible setter that accepts either a user object or updater callback.
    const setAuthenticatedUser = (nextUserOrUpdater) => {
        setUser((previousUser) => {
            const resolvedUser = typeof nextUserOrUpdater === 'function'
                ? nextUserOrUpdater(previousUser)
                : nextUserOrUpdater;

            // Keep auth boolean synchronized with whether user data exists.
            setIsAuthenticated(Boolean(resolvedUser));
            return resolvedUser;
        });
    };

    // Server logout + local auth cleanup to fully end session on both sides.
    const logout = async () => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            await fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch (err) {
            // Even if remote logout fails, proceed with local cleanup for UX consistency.
            console.error('Logout failed:', err);
        } finally {
            // Remove cached CSRF token and reset auth state in memory.
            clearCsrfToken();
            setUser(null);
            setIsAuthenticated(false);
        }
    };

    // Sends profile field updates and rehydrates user context from server response.
    const updateProfile = async (profileUpdates) => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${API_URL}/api/profile`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(profileUpdates),
        });

        const data = await response.json();
        // Throw to let calling UI handle and display operation-specific errors.
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Profile update failed');
        }

        // Persist latest user snapshot from backend.
        setUser(data.user);
        return data.user;
    };

    // Uploads avatar file via multipart/form-data and updates user context on success.
    const uploadAvatar = async (file) => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await fetch(`${API_URL}/api/profile/avatar`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });

        const data = await response.json();
        // Throw to allow component-level error handling and feedback.
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Avatar upload failed');
        }

        setUser(data.user);
        return data.user;
    };

    // Removes current avatar from profile and syncs updated user payload.
    const removeAvatar = async () => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${API_URL}/api/profile/avatar`, {
            method: 'DELETE',
            credentials: 'include',
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Avatar removal failed');
        }

        setUser(data.user);
        return data.user;
    };

    // Deletes the authenticated account and clears local session state.
    const deleteAccount = async () => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${API_URL}/api/profile`, {
            method: 'DELETE',
            credentials: 'include',
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Account deletion failed');
        }

        // Account no longer exists, so clear in-memory auth state.
        setUser(null);
        setIsAuthenticated(false);
        return data;
    };

    return (
        // Expose session state + auth/profile actions to the entire app tree.
        <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout, updateProfile, uploadAvatar, removeAvatar, deleteAccount, setAuthenticatedUser }}>
            {children}
        </AuthContext.Provider>
    );
}

