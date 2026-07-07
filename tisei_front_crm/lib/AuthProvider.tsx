import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AuthUser, UserRole } from "./types";
import { canAccessRoute } from "./role-access";
import { getStoredUser, clearSession } from "./auth-store";
import { logout as apiLogout, refreshTokens } from "./api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
      void refreshTokens().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export function useRequireAuth() {
  const auth = useAuth();
  useEffect(() => {
    if (!auth.loading && !auth.user) {
      window.location.href = "/login";
    }
  }, [auth.loading, auth.user]);
  return auth;
}

export function useRequireRole(roles: UserRole[]) {
  const auth = useAuth();
  useEffect(() => {
    if (!auth.loading && auth.user && !roles.includes(auth.user.role)) {
      window.location.href = "/";
    }
  }, [auth.loading, auth.user, roles]);
  return auth;
}

export function useCanAccess(path: string) {
  const { user } = useAuth();
  return canAccessRoute(path, user?.role);
}
