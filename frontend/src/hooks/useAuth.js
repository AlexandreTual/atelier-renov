import { useState, useCallback } from 'react';

export const useAuth = () => {
    const [token, setToken] = useState(localStorage.getItem('token'));

    const login = useCallback((newToken) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setToken(null);
    }, []);

    const authenticatedFetch = useCallback(async (url, options = {}) => {
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
        const baseUrl = import.meta.env.VITE_API_URL || '';
        // Helper to ensure we don't get double slashes if baseUrl has one and url starts with one
        const finalUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

        const resp = await fetch(finalUrl, { ...options, headers });
        if (resp.status === 401 || resp.status === 403) {
            logout();
        }
        return resp;
    }, [token, logout]);

    return {
        token,
        authenticatedFetch,
        login,
        logout,
        isAuthenticated: !!token
    };
};
