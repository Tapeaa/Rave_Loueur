import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

interface Client {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string | null;
  avatarUrl: string | null;
}

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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

async function authFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    return { success: false, ...data };
  }
  
  return data;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  const refreshClient = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        // /api/auth/me returns the client directly, not wrapped in { client: ... }
        if (data && data.id) {
          setClient(data);
        } else {
          setClient(null);
        }
      } else {
        setClient(null);
      }
    } catch {
      setClient(null);
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

  const login = async (phone: string, password: string): Promise<AuthResult> => {
    const data = await authFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    });
    
    if (data.success && data.client) {
      setClient(data.client);
      return { success: true, client: data.client };
    }
    
    if (data.needsVerification) {
      return { success: false, needsVerification: true, phone: data.phone };
    }
    
    return { success: false, error: data.error || "Erreur de connexion" };
  };

  const register = async (phone: string, firstName: string, lastName: string, password: string): Promise<AuthResult> => {
    const data = await authFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ phone, firstName, lastName, password }),
    });
    
    if (data.success && data.client) {
      setClient(data.client);
      return { success: true, client: data.client };
    }
    
    return { success: false, error: data.error || "Erreur d'inscription" };
  };

  const verify = async (phone: string, code: string, type: string): Promise<AuthResult> => {
    const data = await authFetch("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code, type }),
    });
    
    if (data.success && data.client) {
      setClient(data.client);
      return { success: true, client: data.client };
    }
    
    return { success: false, error: data.error || "Code invalide ou expiré" };
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
    } finally {
      setClient(null);
      setLocation("/auth");
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
