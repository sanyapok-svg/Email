"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/public/button";
import { IconClose, IconMenu } from "@/components/public/icons";
import { Logo } from "@/components/public/logo";
import { useAuth } from "@/components/public/auth-context";

const LINKS = [
  { href: "/#how", label: "Как работает" },
  { href: "/#features", label: "Возможности" },
  { href: "/#pricing", label: "Тарифы" },
  { href: "/help", label: "Помощь" },
];

export function SiteHeader() {
  const { openAuth } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-[#e2e8f0] bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" aria-label="Почтаход, на главную" className="shrink-0">
          <Logo slogan />
        </Link>
        <nav className="ml-auto hidden items-center gap-6 text-sm font-semibold text-navy lg:flex" aria-label="Разделы">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-3 lg:ml-6 lg:flex">
          <button type="button" className="ph-btn ph-btn-text" onClick={() => openAuth({ mode: "login", source: "header-login" })}>
            Войти
          </button>
          <Button type="button" onClick={() => openAuth({ mode: "register", source: "header-signup" })}>
            Создать аккаунт
          </Button>
        </div>
        <button type="button" className="ph-btn ph-btn-ghost ph-btn-icon ph-burger ml-auto" aria-expanded={open} aria-label={open ? "Закрыть меню" : "Открыть меню"} onClick={() => setOpen((value) => !value)}>
          {open ? <IconClose /> : <IconMenu />}
        </button>
      </div>
      {open ? (
        <nav className="flex flex-col gap-3 border-t border-[#e2e8f0] px-4 py-4 lg:hidden" aria-label="Разделы">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="font-semibold text-navy" onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <button type="button" className="ph-btn ph-btn-text justify-start" onClick={() => { setOpen(false); openAuth({ mode: "login", source: "header-login" }); }}>
            Войти
          </button>
          <Button type="button" onClick={() => { setOpen(false); openAuth({ mode: "register", source: "header-signup" }); }}>
            Создать аккаунт
          </Button>
        </nav>
      ) : null}
    </header>
  );
}
