import Link from "next/link";
import { manrope } from "@/components/public/font";

export default function NotFound() {
  return (
    <div className={`${manrope.className} pochtahod grid min-h-screen place-items-center px-4 py-16`}>
      <main className="max-w-lg text-center">
        <SadEnvelope />
        <h1 className="mt-6 text-4xl">Письмо не дошло</h1>
        <p className="mt-3 text-copy">Страница, которую вы ищете, не найдена. Возможно, она была удалена или вы ошиблись в адресе.</p>
        <Link href="/" className="ph-btn ph-btn-primary mt-6">
          Вернуться на главную
        </Link>
      </main>
    </div>
  );
}

function SadEnvelope() {
  return (
    <svg className="mx-auto h-28 w-36" viewBox="0 0 160 120" aria-hidden="true">
      <rect x="16" y="28" width="128" height="78" rx="12" fill="white" stroke="#1E3A5F" strokeWidth="4" />
      <path d="M24 40 80 78 136 40" fill="none" stroke="#1E3A5F" strokeWidth="4" />
      <circle cx="62" cy="62" r="3" fill="#1E3A5F" />
      <circle cx="98" cy="62" r="3" fill="#1E3A5F" />
      <path d="M68 80c6 6 18 6 24 0" fill="none" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
