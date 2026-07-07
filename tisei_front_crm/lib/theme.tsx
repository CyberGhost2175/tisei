"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { fetchUserSettings, updateUserSettings, type ThemeMode } from "./settings-api";
import { applyTheme, setThemeCookie } from "./theme-utils";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => Promise<void>;
  resolved: "light" | "dark";
  loading: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export type { ThemeMode };

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [loading, setLoading] = useState(true);
  const loadedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      loadedForUserRef.current = null;
      setThemeState("light");
      setResolved(applyTheme("light"));
      setLoading(false);
      return;
    }

    if (loadedForUserRef.current === user.id) return;

    let cancelled = false;
    setLoading(true);

    void fetchUserSettings()
      .then((settings) => {
        if (cancelled) return;
        loadedForUserRef.current = user.id;
        setThemeState(settings.theme);
        setResolved(applyTheme(settings.theme));
        setThemeCookie(settings.theme);
      })
      .catch(() => {
        if (cancelled) return;
        loadedForUserRef.current = user.id;
        setThemeState("light");
        setResolved(applyTheme("light"));
        setThemeCookie("light");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback(
    async (mode: ThemeMode) => {
      setThemeState(mode);
      setResolved(applyTheme(mode));
      setThemeCookie(mode);

      if (!user) return;

      try {
        const settings = await updateUserSettings({ theme: mode });
        setThemeState(settings.theme);
        setResolved(applyTheme(settings.theme));
        setThemeCookie(settings.theme);
      } catch {
        /* локальная тема уже применена */
      }
    },
    [user],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}
