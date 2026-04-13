import { useState, useEffect } from 'react';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Check if user is logged in on app load
    useEffect(() => {
        const verifyAuth = async () => {
            try {
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const response = await fetch(`${API_URL}/api/auth/verify`, {
                    credentials: 'include',
                });

                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                    setIsAuthenticated(true);
                }
            } catch (err) {
                console.error('Auth verification failed:', err);
            } finally {
                setIsLoading(false);
            }
        };

        verifyAuth();
    }, []);

    const login = (userData) => {
        setUser(userData);
        setIsAuthenticated(true);
    };

    const setAuthenticatedUser = (nextUserOrUpdater) => {
        setUser((previousUser) => {
            const resolvedUser = typeof nextUserOrUpdater === 'function'
                ? nextUserOrUpdater(previousUser)
                : nextUserOrUpdater;

            setIsAuthenticated(Boolean(resolvedUser));
            return resolvedUser;
        });
    };

    const logout = async () => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            await fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch (err) {
            console.error('Logout failed:', err);
        } finally {
            setUser(null);
            setIsAuthenticated(false);
        }
    };

    const updateProfile = async (profileUpdates) => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${API_URL}/api/auth/profile`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(profileUpdates),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Profile update failed');
        }

        setUser(data.user);
        return data.user;
    };

    const uploadAvatar = async (file) => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await fetch(`${API_URL}/api/auth/profile/avatar`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Avatar upload failed');
        }

        setUser(data.user);
        return data.user;
    };

    const removeAvatar = async () => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${API_URL}/api/auth/profile/avatar`, {
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

    const deleteAccount = async () => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${API_URL}/api/auth/profile`, {
            method: 'DELETE',
            credentials: 'include',
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Account deletion failed');
        }

        setUser(null);
        setIsAuthenticated(false);
        return data;
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout, updateProfile, uploadAvatar, removeAvatar, deleteAccount, setAuthenticatedUser }}>
            {children}
        </AuthContext.Provider>
    );
}
