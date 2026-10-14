import Link from "next/link";
import { Logo } from "@/components/public/logo";

const COLUMNS = [
  {
    title: "Продукт",
    links: [
      { href: "/#how", label: "Как работает" },
      { href: "/#features", label: "Возможности" },
      { href: "/#channels", label: "Каналы доставки" },
      { href: "/#pricing", label: "Тарифы" },
    ],
  },
  {
    title: "Поддержка",
    links: [
      { href: "/help", label: "Помощь" },
      { href: "/contacts", label: "Контакты" },
      { href: "/#final-cta", label: "Подключить ящик" },
    ],
  },
  {
    title: "Юридическое",
    links: [
      { href: "/privacy", label: "Конфиденциальность" },
      { href: "/terms", label: "Условия использования" },
    ],
  },
  {
    title: "Контакты",
    links: [
      { href: "/contacts", label: "Написать нам" },
      { href: "/help", label: "Частые вопросы" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="ph-footer bg-navy">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo tone="light" slogan sloganAlways />
          <h2 className="mt-6 text-sm font-bold">Продукт</h2>
          <FooterLinks links={COLUMNS[0].links} />
        </div>
        {COLUMNS.slice(1).map((column) => (
          <div key={column.title}>
            <h2 className="text-sm font-bold">{column.title}</h2>
            <FooterLinks links={column.links} />
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm">© {new Date().getFullYear()} Почтаход</p>
      </div>
    </footer>
  );
}

function FooterLinks({ links }: { links: Array<{ href: string; label: string }> }) {
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href}>{link.label}</Link>
        </li>
      ))}
    </ul>
  );
}
