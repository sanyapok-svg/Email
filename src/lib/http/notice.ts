export function withNotice(path: string, notice: string): string {
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("notice", notice);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
