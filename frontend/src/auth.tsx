import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { loginAccount, registerAccount } from "./api";

interface AuthState {
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(localStorage.getItem("auth_email"));

  const applyAuth = useCallback((token: string, userEmail: string) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_email", userEmail);
    setEmail(userEmail);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await loginAccount(email, password);
      applyAuth(res.access_token, res.email);
    },
    [applyAuth]
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const res = await registerAccount(email, password);
      applyAuth(res.access_token, res.email);
    },
    [applyAuth]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_email");
    setEmail(null);
  }, []);

  const value = useMemo(() => ({ email, login, register, logout }), [email, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
