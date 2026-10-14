"use client";

import { Button } from "@/components/public/button";
import { useAuth, type AuthMode } from "@/components/public/auth-context";

export function OpenAuthButton({
  children,
  source,
  mode = "register",
}: {
  children: React.ReactNode;
  source: string;
  mode?: AuthMode;
}) {
  const { openAuth } = useAuth();
  return (
    <Button type="button" onClick={() => openAuth({ mode, source })}>
      {children}
    </Button>
  );
}
