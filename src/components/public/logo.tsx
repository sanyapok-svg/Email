import { useId } from "react";

export function Logo({
  tone = "navy",
  slogan = false,
  sloganAlways = false,
  mark = false,
}: {
  tone?: "navy" | "light";
  slogan?: boolean;
  sloganAlways?: boolean;
  mark?: boolean;
}) {
  const color = tone === "light" ? "#ffffff" : "#1E3A5F";
  const sloganColor = tone === "light" ? "#cbd5e1" : "#64748b";
  return (
    <span className="inline-flex items-center gap-3">
      <LogoMark className="h-11 w-11 shrink-0" />
      {mark ? null : (
        <span className="flex flex-col">
          <span className="text-xl font-extrabold leading-none tracking-tight" style={{ color }}>
            Почтаход
          </span>
          {slogan ? (
            <span className={`mt-1 text-xs italic leading-snug ${sloganAlways ? "" : "hidden md:block"}`} style={{ color: sloganColor }}>
              Из общего ящика — в нужные руки
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}

export function LogoMark({ className = "h-11 w-11" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-arrow`} x1="8" y1="58" x2="62" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F97316" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <rect x="6" y="12" width="52" height="40" rx="8" fill="none" stroke="#1E3A5F" strokeWidth="3.5" />
      <path d="M12 18.5 32 34 52 18.5" fill="none" stroke="#1E3A5F" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M12 46.5 26.5 33" fill="none" stroke="#1E3A5F" strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="M28 52c8-1 12-8 14-14 1.2-3.4 4.2-6.2 8.2-7.2 1.6-.4 2.2-2.3 1.1-3.5l-2.6-2.8c-.8-.9-2.2-.7-2.7.4-1.2 2.6-3.6 4.2-6.4 4.6-3.2.5-6.8-1.6-8.2-4.4-.7-1.4-2.6-1.6-3.6-.4L24 29.2c-1.2 1.4-.4 3.6 1.4 4.1 3.2.9 5.2 3.6 5.4 6.8.2 3.6-1.6 7.4-2.8 11.9Z"
        fill={`url(#${id}-arrow)`}
        stroke="white"
        strokeWidth="1.6"
      />
      <path d="M46.5 22.5 58 14l-2.2 10.2-9.3-1.7Z" fill={`url(#${id}-arrow)`} stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
