import Link from "next/link";
import { LogoMark } from "@/components/public/logo";

export function StatusScreen({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-16">
      <div className="max-w-lg text-center">
        <LogoMark className="mx-auto h-16 w-16" />
        <h1 className="mt-6 text-4xl">{title}</h1>
        <p className="mt-3 text-copy">{text}</p>
        <div className="mt-6">{action}</div>
      </div>
    </main>
  );
}

export function HomeLink() {
  return (
    <Link href="/" className="ph-btn ph-btn-primary">
      Вернуться на главную
    </Link>
  );
}
