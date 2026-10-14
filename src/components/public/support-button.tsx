"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconChat, IconClose } from "@/components/public/icons";
import { useAuth } from "@/components/public/auth-context";

export function SupportButton({ lift = false }: { lift?: boolean }) {
  const { openAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [raised, setRaised] = useState(false);

  useEffect(() => {
    if (!lift) return;
    function onScroll() {
      const final = document.getElementById("final-cta");
      const finalVisible = final ? final.getBoundingClientRect().top < window.innerHeight * 0.8 : false;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setRaised(height > 0 && window.scrollY / height >= 0.6 && !finalVisible);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lift]);

  return (
    <div className={`fixed right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 ${raised ? "bottom-36 sm:bottom-24" : "bottom-5"}`}>
      {open ? (
        <div className="ph-card w-64 max-w-full p-4 text-sm text-copy">
          <p className="font-bold text-navy">Поддержка</p>
          <p className="mt-1 text-mist">Подскажем, как подключить ящик и собрать первое правило.</p>
          <Link className="ph-link mt-3 inline-block" href="/help" onClick={() => setOpen(false)}>
            Открыть помощь
          </Link>
          <button type="button" className="ph-btn ph-btn-text mt-2" onClick={() => { setOpen(false); openAuth({ mode: "register", source: "support" }); }}>
            Написать через аккаунт
          </button>
        </div>
      ) : null}
      <button type="button" className="ph-btn ph-btn-primary ph-btn-round shadow-sm" aria-expanded={open} aria-label={open ? "Закрыть поддержку" : "Открыть поддержку"} onClick={() => setOpen((value) => !value)}>
        {open ? <IconClose /> : <IconChat className="h-7 w-7" />}
      </button>
    </div>
  );
}
