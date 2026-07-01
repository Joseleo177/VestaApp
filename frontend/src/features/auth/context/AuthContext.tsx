import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { STORAGE_KEY } from "@/services/api";
import { AuthSession, User, UserRole } from "@/types/domain";
import { authService } from "../services/auth.service";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  role: UserRole | null;
  loading: boolean;
  login: (cedula: string, password: string) => Promise<User>;
  logout: () => void;
  updateUser: (user: User) => void;
}

// El estado global SOLO maneja la sesión (no listas de pagos ni filtros).
export const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadSession()?.user ?? null);
  const [loading, setLoading] = useState(true);

  // Revalida la sesión persistida contra el backend al montar.
  useEffect(() => {
    const session = loadSession();
    if (!session?.token) {
      setLoading(false);
      return;
    }
    authService
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (cedula: string, password: string) => {
    const session = await authService.login({ cedula, password });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    const session = loadSession();
    if (session) {
      const newSession = { ...session, user: updatedUser };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
    }
    setUser(updatedUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === UserRole.ADMIN,
      role: user?.role ?? null,
      loading,
      login,
      logout,
      updateUser,
    }),
    [user, loading, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
