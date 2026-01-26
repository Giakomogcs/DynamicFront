import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthorizedUserContext = createContext({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    login: () => {},
    logout: () => {},
    checkAuth: () => {}
});

export const useAuth = () => useContext(AuthorizedUserContext);

export const AuthorizedUserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkAuth = async () => {
        const token = localStorage.getItem('authToken');
        
        // 1. Check for token in URL (OAuth Callback)
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        
        const effectiveToken = urlToken || token;

        if (!effectiveToken) {
            setIsLoading(false);
            return;
        }

        if (urlToken) {
            // Save to storage and clear URL
            localStorage.setItem('authToken', urlToken);
            window.history.replaceState({}, document.title, window.location.pathname); // clear query params
        }

        try {
            const res = await fetch('http://localhost:3000/auth/me', {
                headers: {
                    'Authorization': `Bearer ${effectiveToken}`
                }
            });

            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
            } else {
                // Invalid token
                localStorage.removeItem('authToken');
                setUser(null);
            }
        } catch (e) {
            console.error("Auth check failed", e);
            localStorage.removeItem('authToken');
        } finally {
            setIsLoading(false);
            
            // Safety cleanup: If we are still on a callback path for some reason, fix it
            if (window.location.pathname.endsWith('/auth/callback')) {
                window.history.replaceState({}, document.title, '/');
            }
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const login = () => {
        // Redirect to Google Auth
        window.location.href = 'http://localhost:3000/auth/google';
    };
    
    const logout = () => {
        localStorage.removeItem('authToken');
        setUser(null);
        window.location.href = '/login';
    };

    return (
        <AuthorizedUserContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            logout,
            checkAuth
        }}>
            {children}
        </AuthorizedUserContext.Provider>
    );
};
