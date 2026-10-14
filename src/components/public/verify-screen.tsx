"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/public/logo";
import { useAuth } from "@/components/public/auth-context";

type Phase = "pending" | "done" | "invalid" | "expired" | "unavailable";

export function VerifyScreen({ token }: { token: string }) {
  const { openAuth } = useAuth();
  const [phase, setPhase] = useState<Phase>("pending");
  const [email, setEmail] = useState("");
  const [already, setAlready] = useState(false);
  const [resent, setResent] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setPhase("invalid");
        return;
      }
      try {
        const response = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await response.json()) as { ok?: boolean; code?: string; email?: string; already?: boolean };
        if (cancelled) return;
        if (data.ok) {
          setAlready(Boolean(data.already));
          setPhase("done");
          return;
        }
        if (data.email) setEmail(data.email);
        if (data.code === "expired") setPhase("expired");
        else if (data.code === "unavailable") setPhase("unavailable");
        else setPhase("invalid");
      } catch {
        if (!cancelled) setPhase("unavailable");
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function resend() {
    setResent("");
    try {
      const response = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "verify" }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; devUrl?: string | null };
      if (!response.ok || !data.ok) {
        setResent(data.error || "Не удалось отправить письмо");
        return;
      }
      setResent(data.devUrl ? "Новая ссылка готова ниже." : "Отправили новое письмо.");
      if (data.devUrl) setResent(data.devUrl);
    } catch {
      setResent("Сеть недоступна. Попробуйте ещё раз.");
    }
  }

  if (phase === "pending") {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className="verify-orbit mx-auto">
            <div className="grid h-full place-items-center">
              <LogoMark className="h-16 w-16" />
            </div>
            <span className="verify-arrow">
              <svg viewBox="0 0 120 120" className="h-full w-full">
                <path d="M60 8 68 22 54 20Z" fill="#F97316" />
              </svg>
            </span>
          </div>
          <h1 className="mt-6 text-3xl">Подтверждаем почту</h1>
          <p className="mt-2 text-copy">Сейчас аккаунт станет активным. Вход после этого — по логину и паролю.</p>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-16">
        <div className="ph-card max-w-md p-8 text-center">
          <LogoMark className="mx-auto h-14 w-14" />
          <h1 className="mt-4 text-3xl">{already ? "Почта уже подтверждена" : "Почта подтверждена"}</h1>
          <p className="mt-2 text-copy">Аккаунт активен. Войдите логином и паролем, которые задали при регистрации.</p>
          <button type="button" className="ph-btn ph-btn-primary mt-6" onClick={() => openAuth({ mode: "login", source: "verify-done" })}>
            Войти
          </button>
        </div>
      </main>
    );
  }

  const copy = {
    invalid: ["Ссылка устарела или неверна", "Подтвердить аккаунт по ней уже нельзя."],
    expired: ["Ссылка устарела или неверна", "Срок ссылки — 24 часа. Можно прислать новую на тот же адрес."],
    unavailable: ["Что-то пошло не так", "Не удалось подтвердить почту. Попробуйте ещё раз через минуту."],
  }[phase];

  return (
    <main className="grid min-h-screen place-items-center px-4 py-16">
      <div className="ph-card max-w-md p-8 text-center">
        <LogoMark className="mx-auto h-14 w-14" />
        <h1 className="mt-4 text-3xl">{copy[0]}</h1>
        <p className="mt-2 text-copy">{copy[1]}</p>
        {phase === "expired" && email ? (
          <button type="button" className="ph-btn ph-btn-primary mt-6" onClick={() => void resend()}>
            Прислать новую ссылку
          </button>
        ) : (
          <button type="button" className="ph-btn ph-btn-primary mt-6" onClick={() => openAuth({ mode: "login", source: "verify" })}>
            Войти
          </button>
        )}
        {resent ? <p className="mt-3 break-all text-sm text-copy">{resent.startsWith("http") ? <a className="ph-link" href={resent}>{resent}</a> : resent}</p> : null}
      </div>
    </main>
  );
}
