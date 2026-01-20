/**
 * Authentication Context
 * Manages user authentication state across the application
 */

import { createContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@/types';
import { getDefaultUser } from '@/lib/auth/userManagerAuth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Fetch default user on mount
    getDefaultUser()
      .then(defaultUser => {
        setUser(defaultUser);
        setError(null);
      })
      .catch(err => {
        console.error('Failed to load user:', err);
        setError(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const logout = () => {
    setUser(null);
    // Clear any stored tokens or session data
    localStorage.removeItem('auth_token');
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    setUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
