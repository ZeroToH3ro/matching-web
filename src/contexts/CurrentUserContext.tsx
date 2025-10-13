'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface CurrentUser {
  id: string;
  email?: string;
  name?: string;
}

interface CurrentUserContextType {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserContextType | undefined>(undefined);

interface CurrentUserProviderProps {
  children: ReactNode;
}

export function CurrentUserProvider({ children }: CurrentUserProviderProps) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/me');
      
      if (response.status === 401) {
        // User not authenticated
        setUser(null);
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.status}`);
      }

      const userData = await response.json();
      setUser(userData.user || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const value: CurrentUserContextType = {
    user,
    loading,
    error,
    refetch: fetchCurrentUser
  };

  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserContextType {
  const context = useContext(CurrentUserContext);
  if (context === undefined) {
    // Instead of throwing an error, return a default state
    console.warn('useCurrentUser called outside of CurrentUserProvider, returning default state');
    return {
      user: null,
      loading: false,
      error: 'Context not available',
      refetch: async () => {}
    };
  }
  return context;
}