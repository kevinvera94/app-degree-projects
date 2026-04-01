import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { supabase } from "../services/supabase";
import { setAuthToken } from "../services/api";
import type { AuthUser } from "../types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrateFromSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session) {
      const jwt = session.access_token;
      setToken(jwt);
      setAuthToken(jwt);
      setUser({
        id: session.user.id,
        full_name: session.user.user_metadata?.full_name ?? "",
        email: session.user.email ?? "",
        role: session.user.user_metadata?.role ?? "estudiante",
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    hydrateFromSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          const jwt = session.access_token;
          setToken(jwt);
          setAuthToken(jwt);
          setUser({
            id: session.user.id,
            full_name: session.user.user_metadata?.full_name ?? "",
            email: session.user.email ?? "",
            role: session.user.user_metadata?.role ?? "estudiante",
          });
        } else {
          setToken(null);
          setAuthToken(null);
          setUser(null);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [hydrateFromSession]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data.session) {
      const jwt = data.session.access_token;
      setToken(jwt);
      setAuthToken(jwt);
      setUser({
        id: data.session.user.id,
        full_name: data.session.user.user_metadata?.full_name ?? "",
        email: data.session.user.email ?? "",
        role: data.session.user.user_metadata?.role ?? "estudiante",
      });
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setToken(null);
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
