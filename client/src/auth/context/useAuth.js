import { createContext, useContext } from 'react';

// Shared authentication context consumed throughout the client app.
export const AuthContext = createContext();

/**
 * useAuth:
 * Convenience hook for consuming AuthContext with a guard that enforces
 * usage within AuthProvider to prevent undefined context access.
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
