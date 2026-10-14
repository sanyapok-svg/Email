"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AuthMode } from "@/components/public/auth-context";
import { Button } from "@/components/public/button";
import { IconClose } from "@/components/public/icons";
import { Logo } from "@/components/public/logo";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN = /^[^\s]{2,64}$/;

type Sent = { email: string; delivered: boolean; devUrl?: string | null; note?: string | null };

export function AuthModal({
  mode: initialMode,
  source,
  email: initialEmail = "",
  intent,
  onClose,
}: {
  mode: AuthMode;
  source?: string;
  email?: string;
  intent?: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      if (sent) dialogRef.current?.querySelector("button")?.focus();
      else firstField.current?.focus();
    }, 20);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>("button, a, input, select, textarea")].filter(
        (item) => !item.hasAttribute("disabled"),
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
    };
  }, [sent, onClose]);

  useEffect(() => {
    if (!sent || seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [sent, seconds]);

  async function resend(address: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: address, source }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; delivered?: boolean; devUrl?: string | null; retryAfter?: number };
      if (!response.ok || !data.ok) {
        setError(data.error || "Не удалось отправить письмо");
        if (data.retryAfter) setSeconds(data.retryAfter);
        return;
      }
      setSent({ email: address, delivered: Boolean(data.delivered), devUrl: data.devUrl, note: data.error });
      setSeconds(30);
      setUnconfirmedEmail("");
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (mode === "login") {
      if (!login.trim() || !password) {
        setError("Введите логин и пароль");
        return;
      }
      setPending(true);
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ login, password }),
        });
        const data = (await response.json()) as { ok?: boolean; code?: string; email?: string };
        if (data.ok) {
          window.location.assign("/");
          return;
        }
        if (data.code === "unconfirmed") {
          setUnconfirmedEmail(data.email || "");
          setError("Аккаунт ещё не активен. Откройте ссылку из письма, чтобы подтвердить почту.");
          return;
        }
        if (data.code === "disabled") setError("Учётная запись отключена");
        else if (data.code === "no-account") setError("Нет доступного аккаунта");
        else if (data.code === "unavailable") setError("Сервис входа временно недоступен");
        else setError("Неверный логин или пароль");
      } catch {
        setError("Сеть недоступна. Попробуйте ещё раз.");
      } finally {
        setPending(false);
      }
      return;
    }
    if (!LOGIN.test(login.trim())) {
      setError("Логин — от 2 до 64 символов, без пробелов");
      return;
    }
    if (password.length < 5) {
      setError("Пароль — не короче 5 символов");
      return;
    }
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address)) {
      setError("Введите рабочий email, например you@company.ru");
      return;
    }
    if (!consent) {
      setError("Нужно согласие с условиями и политикой конфиденциальности");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login, password, email: address, consent: true, source }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; delivered?: boolean; devUrl?: string | null; retryAfter?: number };
      if (!response.ok || !data.ok) {
        setError(data.error || "Не удалось создать аккаунт");
        if (data.retryAfter) setSeconds(data.retryAfter);
        return;
      }
      setSent({ email: address, delivered: Boolean(data.delivered), devUrl: data.devUrl, note: data.error });
      setSeconds(30);
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" style={{ background: "rgba(30, 58, 95, 0.48)" }} onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ph-dialog ph-card max-h-[90vh] w-full overflow-y-auto rounded-t-2xl p-5 shadow-sm sm:max-w-md sm:rounded-xl sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <Logo />
          <button type="button" className="ph-btn ph-btn-ghost ph-btn-icon" aria-label="Закрыть" onClick={onClose}>
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        {sent ? (
          <SentState titleId={titleId} sent={sent} seconds={seconds} pending={pending} onResend={() => void resend(sent.email)} />
        ) : (
          <form className="mt-6" onSubmit={(event) => void submit(event)}>
            <h2 id={titleId} className="text-3xl">{mode === "register" ? "Создать аккаунт" : "Войти"}</h2>
            <p className="mt-2 text-mist">
              {mode === "register"
                ? "Задайте логин и пароль. Аккаунт включится после подтверждения почты."
                : "Вход по логину и паролю, как в кабинете."}
            </p>
            {intent ? <p className="ph-card mt-4 px-3 py-2 text-sm text-copy">{intent}</p> : null}
            <label className="mt-5 block text-sm font-semibold text-navy" htmlFor={`${titleId}-login`}>
              Логин
              <input
                ref={firstField}
                id={`${titleId}-login`}
                className="mt-1"
                name="username"
                autoComplete="username"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                required
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-navy" htmlFor={`${titleId}-password`}>
              Пароль
              <input
                id={`${titleId}-password`}
                className="mt-1"
                name="password"
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {mode === "register" ? (
              <label className="mt-4 block text-sm font-semibold text-navy" htmlFor={`${titleId}-email`}>
                Рабочий email
                <input
                  id={`${titleId}-email`}
                  className="mt-1"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@company.ru"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
            ) : null}
            {mode === "register" ? (
              <label className="mt-4 flex items-start gap-3 text-sm text-copy">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                <span>
                  Соглашаюсь с <a className="ph-link" href="/terms">условиями</a> и <a className="ph-link" href="/privacy">политикой конфиденциальности</a>
                </span>
              </label>
            ) : null}
            {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
            {mode === "login" && unconfirmedEmail ? (
              <button type="button" className="ph-btn ph-btn-text mt-2" disabled={pending} onClick={() => void resend(unconfirmedEmail)}>
                Отправить письмо ещё раз
              </button>
            ) : null}
            <Button className="mt-5" block type="submit" disabled={pending}>
              {pending ? "Проверяем…" : mode === "register" ? "Создать аккаунт" : "Войти"}
            </Button>
            <p className="mt-3 text-sm text-mist">
              {mode === "register" ? "Пока почта не подтверждена, войти нельзя." : "Пароль задаётся при создании аккаунта."}
            </p>
            <button
              type="button"
              className="ph-btn ph-btn-text mt-4"
              onClick={() => {
                setMode(mode === "register" ? "login" : "register");
                setError("");
                setUnconfirmedEmail("");
              }}
            >
              {mode === "register" ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Создать"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function SentState({
  titleId,
  sent,
  seconds,
  pending,
  onResend,
}: {
  titleId: string;
  sent: Sent;
  seconds: number;
  pending: boolean;
  onResend: () => void;
}) {
  return (
    <div className="mt-6">
      <h2 id={titleId} className="text-3xl">Аккаунт создан</h2>
      <p className="mt-2 text-copy">
        {sent.delivered
          ? `Он ещё не активен. Отправили ссылку на ${sent.email}: откройте её, чтобы подтвердить почту. Затем войдите логином и паролем.`
          : sent.devUrl
            ? `Он ещё не активен. Письмо на ${sent.email} не ушло — для локальной проверки откройте ссылку подтверждения.`
            : `Он создан, но ещё не активен: письмо на ${sent.email} не отправилось.`}
      </p>
      {sent.note ? <p className="mt-3 text-sm text-clay">{sent.note}</p> : null}
      {sent.devUrl ? (
        <a className="ph-link mt-3 inline-block break-all text-sm" href={sent.devUrl}>
          Открыть ссылку подтверждения
        </a>
      ) : null}
      <Button className="mt-5" block type="button" disabled={pending || seconds > 0} onClick={onResend}>
        {seconds > 0 ? `Отправить письмо ещё раз · ${seconds}` : "Отправить письмо ещё раз"}
      </Button>
    </div>
  );
}
