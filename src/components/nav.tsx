const LINKS = [
  ["/", "Обзор"],
  ["/mailboxes", "Ящики"],
  ["/rules", "Правила"],
  ["/users", "Пользователи"],
  ["/messages", "Письма"],
  ["/notifications", "Уведомления"],
  ["/replies", "Ответы"],
  ["/templates", "Шаблоны"],
  ["/metrics", "Метрики"],
  ["/settings", "Настройки"],
];

export function Nav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {LINKS.map(([href, label]) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <a
            key={href}
            href={href}
            className={`rounded-md px-3 py-2 text-sm ${active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10"}`}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
