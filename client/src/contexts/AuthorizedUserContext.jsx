import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthorizedUserContext = createContext(null);

export const AuthorizedUserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        const fullUrl = window.location.href;
        const search = window.location.search;
        console.log('[AuthContext] checkAuth invoked.');

        const tokenInStorage = localStorage.getItem('authToken');

        // 1. Check for token in URL (OAuth Callback)
        const params = new URLSearchParams(search);
        const urlToken = params.get('token');

        const effectiveToken = urlToken || tokenInStorage;

        // console.log('[AuthContext] Token state:', { ... });

        if (!effectiveToken) {
            console.log('[AuthContext] No token available, clearing auth state');
            setUser(null);
            setIsLoading(false);
            return;
        }

        try {
            console.log(`[AuthContext] Verifying token...`);
            const res = await fetch('http://localhost:3000/auth/me', {
                headers: {
                    'Authorization': `Bearer ${effectiveToken}`
                }
            });

            console.log('[AuthContext] Backend response status:', res.status);

            if (res.ok) {
                const userData = await res.json();
                console.log('[AuthContext] Auth Success!');

                // Only save and clear URL if we actually got it from URL
                if (urlToken) {
                    console.log('[AuthContext] Persisting URL token to localStorage');
                    localStorage.setItem('authToken', urlToken);
                    // Use replaceState to remove the query params without reloading
                    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                    window.history.replaceState({ path: newUrl }, '', newUrl);
                }

                setUser(userData);
            } else {
                const errData = await res.json().catch(() => ({}));
                console.warn('[AuthContext] Auth failed on backend:', errData.error || res.statusText);
                localStorage.removeItem('authToken');
                setUser(null);
            }
        } catch (e) {
            console.error("[AuthContext] Fetch failed (Network Error?):", e);
            // Don't clear token on network error (like CORS or offline)
            // localStorage.removeItem('authToken'); 
            // setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        console.log('[AuthContext] Provider mounted, triggering initial checkAuth');
        checkAuth();
    }, [checkAuth]);

    const login = () => {
        console.log('[AuthContext] Redirecting to Google Login via backend 3000...');
        window.location.href = 'http://localhost:3000/auth/google';
    };

    const logout = () => {
        console.log('[AuthContext] Logging out');
        localStorage.removeItem('authToken');
        setUser(null);
        window.location.href = '/login';
    };

    const value = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        checkAuth
    };

    return (
        <AuthorizedUserContext.Provider value={value}>
            {children}
        </AuthorizedUserContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthorizedUserContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthorizedUserProvider');
    }
    return context;
};
