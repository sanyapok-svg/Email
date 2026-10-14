"use client";

import { IconGear } from "@/components/public/icons";

export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-16">
      <div className="max-w-lg text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-white text-navy shadow-sm">
          <IconGear className="h-9 w-9" />
        </span>
        <h1 className="mt-6 text-4xl">Что-то пошло не так</h1>
        <p className="mt-3 text-copy">Наши инженеры уже разбираются с проблемой. Попробуйте обновить страницу через пару минут.</p>
        <button type="button" className="ph-btn ph-btn-primary mt-6" onClick={() => reset()}>
          Обновить
        </button>
      </div>
    </main>
  );
}
