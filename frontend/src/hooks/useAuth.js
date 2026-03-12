import { useState, useCallback } from 'react';

export const useAuth = () => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(null);

    const authenticatedFetch = useCallback(async (url, options = {}) => {
        const currentToken = localStorage.getItem('token');
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${currentToken}`
        };
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const finalUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

        const resp = await fetch(finalUrl, { ...options, headers });
        if (resp.status === 401 || resp.status === 403) {
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
        }
        return resp;
    }, []);

    const fetchMe = useCallback(async (currentToken) => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL || '';
            const resp = await fetch(`${baseUrl}/api/me`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setUser(data);
            }
        } catch (err) {
            // non-blocking
        }
    }, []);

    const login = useCallback((newToken) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        fetchMe(newToken);
    }, [fetchMe]);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    }, []);

    const markOnboardingDone = useCallback(async () => {
        const currentToken = localStorage.getItem('token');
        const baseUrl = import.meta.env.VITE_API_URL || '';
        try {
            await fetch(`${baseUrl}/api/onboarding/complete`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            setUser(prev => prev ? { ...prev, onboarding_done: 1 } : prev);
        } catch (err) {
            // non-blocking
        }
    }, []);

    return {
        token,
        user,
        authenticatedFetch,
        login,
        logout,
        markOnboardingDone,
        isAuthenticated: !!token,
        fetchMe,
    };
};
