const LINKS = [
  ["/", "Обзор"],
  ["/mailboxes", "Ящики"],
  ["/users", "Пользователи"],
  ["/b24-users", "Сотрудники Б24"],
  ["/messages", "Письма"],
  ["/notifications", "Уведомления"],
  ["/metrics", "Метрики"],
  ["/settings", "Настройки"],
];

export function Nav({ pathname, showAccounts = false }: { pathname: string; showAccounts?: boolean }) {
  const links = showAccounts ? [...LINKS, ["/accounts", "Аккаунты"]] : LINKS;
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
      {links.map(([href, label]) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/mailboxes" && pathname.startsWith("/rules"));
        return (
          <a
            key={href}
            href={href}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium md:shrink ${active ? "bg-lilac text-pine" : "text-white/75 hover:bg-white/10"}`}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
