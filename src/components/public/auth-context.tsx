"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import { AuthModal } from "@/components/public/auth-modal";

export type AuthMode = "login" | "register";

export type AuthOpen = {
  mode?: AuthMode;
  source?: string;
  email?: string;
  intent?: string;
};

type AuthContextValue = {
  openAuth: (options?: AuthOpen) => void;
  closeAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const trigger = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<AuthOpen | null>(null);

  const api = useMemo<AuthContextValue>(
    () => ({
      openAuth: (options) => {
        trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setState({ mode: options?.mode ?? "register", source: options?.source, email: options?.email, intent: options?.intent });
      },
      closeAuth: () => {
        setState(null);
        const back = trigger.current;
        trigger.current = null;
        requestAnimationFrame(() => back?.focus());
      },
    }),
    [],
  );

  return (
    <AuthContext.Provider value={api}>
      {children}
      {state ? (
        <AuthModal
          mode={state.mode ?? "register"}
          source={state.source}
          email={state.email}
          intent={state.intent}
          onClose={api.closeAuth}
        />
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Окно входа доступно только внутри публичных страниц");
  return value;
}
