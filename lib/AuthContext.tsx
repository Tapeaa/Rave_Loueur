import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { apiFetch, removeClientSessionId, getClientSessionId } from './api';
import type { Client } from './types';

interface AuthContextType {
  client: Client | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refreshClient: () => Promise<void>;
  setClientDirectly: (client: Client) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  const refreshClient = async () => {
    try {
      const sessionId = await getClientSessionId();
      if (!sessionId) {
        setClient(null);
        return;
      }

      const data = await apiFetch<Client>('/api/auth/me');
      if (data && data.id) {
        setClient(data);
      } else {
        setClient(null);
        await removeClientSessionId();
      }
    } catch {
      setClient(null);
      await removeClientSessionId();
    }
  };

  const setClientDirectly = (newClient: Client) => {
    setClient(newClient);
  };

  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      await refreshClient();
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inDriverGroup = segments[0] === '(chauffeur)';

    // App Loueur : pas de compte client. Porte d’entrée = code 6 chiffres.
    if (!inAuthGroup && !inDriverGroup) {
      router.replace('/(chauffeur)/login');
    }
  }, [segments, isLoading]);

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
    } finally {
      await removeClientSessionId();
      setClient(null);
      router.replace('/(chauffeur)/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        client,
        isLoading,
        isAuthenticated: !!client,
        logout,
        refreshClient,
        setClientDirectly,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
