import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { apiFetch, apiPost, setClientSessionId, removeClientSessionId, getClientSessionId } from './api';
import type { Client } from './types';

interface AuthResult {
  success: boolean;
  needsVerification?: boolean;
  phone?: string;
  error?: string;
  client?: Client;
  devCode?: string;
}

interface AuthContextType {
  client: Client | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<AuthResult>;
  register: (phone: string, firstName: string, lastName: string, password: string) => Promise<AuthResult>;
  verify: (phone: string, code: string, type: string) => Promise<AuthResult>;
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

    if (!client && !inAuthGroup && !inDriverGroup) {
      router.replace('/(auth)/welcome');
    } else if (client && inAuthGroup) {
      router.replace('/(client)/');
    }
  }, [client, segments, isLoading]);

  const login = async (phone: string, password: string): Promise<AuthResult> => {
    // Normaliser le numéro de téléphone pour la vérification du compte de test
    const cleanPhone = phone.replace(/\+689/g, '').replace(/\s/g, '').trim();
    
    // Vérification du compte de test
    if (cleanPhone === '87000000' && password === '12345') {
      const testClient: Client = {
        id: 'test-client-1',
        phone: '+68987000000',
        firstName: 'Test',
        lastName: 'Utilisateur',
        email: 'test@tapea.pf',
        isVerified: true,
        walletBalance: 5000,
        averageRating: 4.8,
        totalRides: 12,
        createdAt: new Date().toISOString(),
      };
      await setClientSessionId('test-session-id');
      setClient(testClient);
      return { success: true, client: testClient };
    }

    try {
      const data = await apiPost<{
        success: boolean;
        client?: Client;
        session?: { id: string };
        needsVerification?: boolean;
        phone?: string;
        error?: string;
      }>('/api/auth/login', { phone, password }, { skipAuth: true });

      if (data.success && data.client) {
        // L'API peut retourner session.id ou utiliser des cookies, donc on vérifie les deux
        if (data.session?.id) {
          await setClientSessionId(data.session.id);
        }
        setClient(data.client);
        return { success: true, client: data.client };
      }

      if (data.needsVerification) {
        return { success: false, needsVerification: true, phone: data.phone };
      }

      return { success: false, error: data.error || 'Erreur de connexion' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  const register = async (
    phone: string,
    firstName: string,
    lastName: string,
    password: string
  ): Promise<AuthResult> => {
    try {
      const data = await apiPost<{
        success: boolean;
        client?: Client;
        session?: { id: string };
        error?: string;
        devCode?: string;
      }>('/api/auth/register', { phone, firstName, lastName, password }, { skipAuth: true });

      if (data.success && data.client && data.session) {
        await setClientSessionId(data.session.id);
        setClient(data.client);
        return { success: true, client: data.client, devCode: data.devCode };
      }

      return { success: false, error: data.error || "Erreur d'inscription", devCode: data.devCode };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  const verify = async (phone: string, code: string, type: string): Promise<AuthResult> => {
    try {
      const data = await apiPost<{
        success: boolean;
        client?: Client;
        session?: { id: string };
        error?: string;
      }>('/api/auth/verify', { phone, code, type }, { skipAuth: true });

      if (data.success && data.client && data.session) {
        await setClientSessionId(data.session.id);
        setClient(data.client);
        return { success: true, client: data.client };
      }

      return { success: false, error: data.error || 'Code invalide ou expiré' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
    } finally {
      await removeClientSessionId();
      setClient(null);
      router.replace('/(auth)/welcome');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        client,
        isLoading,
        isAuthenticated: !!client,
        login,
        register,
        verify,
        logout,
        refreshClient,
        setClientDirectly,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
