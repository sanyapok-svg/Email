"use client";

import { useState } from "react";
import { Button } from "@/components/public/button";
import { useAuth } from "@/components/public/auth-context";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function FinalCta() {
  const { openAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL.test(value)) {
      setError("Введите рабочий email");
      return;
    }
    openAuth({ mode: "register", source: "final-cta", email: value });
  }

  return (
    <section id="final-cta" className="ph-on-navy scroll-mt-24 bg-navy py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-3xl md:text-5xl">Подключите свой ящик за 5 минут</h2>
        <form className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row" onSubmit={submit}>
          <label className="sr-only" htmlFor="final-email">Рабочий email</label>
          <input id="final-email" className="ph-inline-email sm:flex-1" type="email" inputMode="email" autoComplete="email" placeholder="you@company.ru" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Button className="w-full sm:w-auto" type="submit">Создать аккаунт</Button>
        </form>
        {error ? <p className="mt-3 text-sm text-honey">{error}</p> : null}
        <p className="mt-4 text-sm">
          Дальше — логин и пароль. Аккаунт включится после подтверждения почты. Нажимая кнопку, вы перейдёте к{" "}
          <a className="ph-link" href="/terms">условиям</a> и <a className="ph-link" href="/privacy">политике</a>.
        </p>
        <button type="button" className="ph-btn ph-btn-text mt-3" onClick={() => openAuth({ mode: "login", source: "final-login" })}>
          Уже есть аккаунт? Войти
        </button>
      </div>
    </section>
  );
}
