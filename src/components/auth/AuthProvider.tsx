"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  logout as apiLogout,
  type LoginResponse,
  loginAdmin,
  loginUser,
  refreshTokens,
  sendVerificationCode,
  updateCurrentUser,
} from "@/lib/auth/api";

interface AuthSession extends LoginResponse {
  tokenExpiresAt: number;
}

interface AuthContextValue {
  user: LoginResponse["user"] | null;
  accessToken: string | null;
  refreshToken: string | null;
  scope: string | null;
  loading: boolean;
  sendCode: (
    email: string,
    options?: { password?: string; purpose?: "register" | "login" },
  ) => Promise<void>;
  login: (options: {
    email: string;
    password?: string;
    code: string;
    isAdmin?: boolean;
  }) => Promise<void>;
  loginWithPassword: (options: {
    username: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  adoptLoginResponse: (response: LoginResponse) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "oosh.auth";
const REFRESH_INTERVAL_MS = 48 * 60 * 60 * 1000; // 48h

function parseExpiresIn(expiresIn: string): number {
  const trimmed = expiresIn.trim();
  const match = trimmed.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return 3 * 24 * 60 * 60 * 1000; // default 3 days
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return value * 1000;
  }
}

function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    readStoredSession(),
  );
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFromResponse = useCallback((resp: LoginResponse) => {
    const tokenExpiresAt = Date.now() + parseExpiresIn(resp.expiresIn);
    const next: AuthSession = {
      ...resp,
      tokenExpiresAt,
    };
    setSession(next);
  }, []);

  const doRefresh = useCallback(async () => {
    if (!session?.refreshToken) return;
    try {
      const resp = await refreshTokens(
        session.refreshToken,
        session.user.scope,
      );
      setFromResponse(resp);
    } catch (error) {
      console.error("Refresh failed", error);
      setSession(null);
    }
  }, [session?.refreshToken, session?.user.scope, setFromResponse]);

  const scheduleRefresh = useCallback(
    (delay = REFRESH_INTERVAL_MS) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (!session?.refreshToken) return;
      refreshTimer.current = setTimeout(() => {
        void doRefresh();
      }, delay);
    },
    [session?.refreshToken, doRefresh],
  );

  useEffect(() => {
    if (session) {
      writeStoredSession(session);
      const expiresInMs = session.tokenExpiresAt - Date.now();
      const delay = Math.min(
        REFRESH_INTERVAL_MS,
        Math.max(5 * 60 * 1000, expiresInMs - 5 * 60 * 1000),
      );
      scheduleRefresh(delay);
    } else {
      writeStoredSession(null);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    }
  }, [session, scheduleRefresh]);

  useEffect(() => {
    setLoading(false);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!loading && session && session.tokenExpiresAt <= Date.now()) {
      void doRefresh();
    }
  }, [loading, session, doRefresh]);

  const sendCode = useCallback(
    async (
      email: string,
      options?: { password?: string; purpose?: "register" | "login" },
    ) => {
      await sendVerificationCode(email, options);
    },
    [],
  );

  const login = useCallback(
    async ({
      email,
      password,
      code,
      isAdmin,
    }: {
      email: string;
      password?: string;
      code: string;
      isAdmin?: boolean;
    }) => {
      const resp = await (isAdmin
        ? loginAdmin(email, password || "", code)
        : loginUser({ email, code }));
      setFromResponse(resp);
    },
    [setFromResponse],
  );

  const logout = useCallback(async () => {
    if (session?.token) {
      try {
        await apiLogout(session.token);
      } catch (error) {
        console.error("Logout failed", error);
      }
    }
    setSession(null);
  }, [session?.token]);

  const loginWithPassword = useCallback(
    async ({ username, password }: { username: string; password: string }) => {
      const resp = await loginUser({ username: username.trim(), password });
      setFromResponse(resp);
    },
    [setFromResponse],
  );

  const adoptLoginResponse = useCallback(
    (response: LoginResponse) => {
      setFromResponse(response);
    },
    [setFromResponse],
  );

  const updateProfile = useCallback(
    async (displayName: string) => {
      if (!session?.token) throw new Error("Not authenticated");
      const updatedUser = await updateCurrentUser(
        { display_name: displayName },
        session.token,
      );
      setSession((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                ...updatedUser,
                display_name: updatedUser.display_name ?? displayName,
              },
            }
          : prev,
      );
    },
    [session?.token],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.token ?? null,
      refreshToken: session?.refreshToken ?? null,
      scope: session?.user.scope ?? null,
      loading,
      sendCode,
      login,
      loginWithPassword,
      logout,
      refresh: doRefresh,
      updateProfile,
      adoptLoginResponse,
    }),
    [
      session,
      loading,
      sendCode,
      login,
      loginWithPassword,
      logout,
      doRefresh,
      updateProfile,
      adoptLoginResponse,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthContext missing");
  return ctx;
}
