"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/public/button";
import { useAuth } from "@/components/public/auth-context";

export function StickyCta() {
  const { openAuth } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const progress = height > 0 ? window.scrollY / height : 0;
      const final = document.getElementById("final-cta");
      const finalVisible = final ? final.getBoundingClientRect().top < window.innerHeight * 0.8 : false;
      setVisible(progress >= 0.6 && !finalVisible);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;
  return (
    <div className="ph-sticky fixed inset-x-0 bottom-0 z-30 border-t border-[#e2e8f0] bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="ph-actions mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-navy">Подключите общий ящик за 5 минут</p>
        <Button type="button" onClick={() => openAuth({ mode: "register", source: "sticky" })}>
          Создать аккаунт
        </Button>
      </div>
    </div>
  );
}
