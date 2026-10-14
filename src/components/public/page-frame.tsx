import Link from "next/link";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { SupportButton } from "@/components/public/support-button";

export function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[70vh] max-w-3xl px-4 py-16">{children}</main>
      <SiteFooter />
      <SupportButton />
    </>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="ph-link" href={href}>
      {children}
    </Link>
  );
}
