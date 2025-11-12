'use client';

import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type AuthContextValue = {
  user: Record<string, unknown> | null;
  loading: boolean;
};

const AUTH_USER_STORAGE_KEY = "authUser";

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

function readStoredUser(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.error("Failed to parse auth user from storage", error);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUser = useCallback(() => {
    const stored = readStoredUser();
    setUser(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    syncUser();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTH_USER_STORAGE_KEY) {
        syncUser();
      }
    };

    const handleAuthUpdate = () => {
      syncUser();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("auth:updated", handleAuthUpdate as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("auth:updated", handleAuthUpdate as EventListener);
    };
  }, [syncUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

