"use client";

import "./globals.css";
import { manrope } from "@/components/public/font";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body className={`${manrope.className} pochtahod grid min-h-screen place-items-center px-4`}>
        <main className="max-w-lg text-center">
          <svg className="mx-auto h-24 w-24" viewBox="0 0 80 80" aria-hidden="true">
            <rect x="10" y="22" width="60" height="40" rx="8" fill="none" stroke="#1E3A5F" strokeWidth="3" />
            <path d="M16 28 40 44 64 28" fill="none" stroke="#1E3A5F" strokeWidth="3" />
            <path d="M18 18 62 62" stroke="#F97316" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <h1 className="mt-6 text-4xl">Что-то пошло не так</h1>
          <p className="mt-3">Наши инженеры уже разбираются с проблемой. Попробуйте обновить страницу через пару минут.</p>
          <button type="button" className="ph-btn ph-btn-primary mt-6" onClick={() => reset()}>
            Обновить
          </button>
        </main>
      </body>
    </html>
  );
}
