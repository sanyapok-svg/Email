import Link from "next/link";
import { IconCheck } from "@/components/public/icons";
import { Reveal } from "@/components/public/reveal";

const POINTS = [
  "Не меняет, не перемещает и не удаляет письма. Ящик открывается только на чтение.",
  "Не открывает папку «Спам».",
  "Не забирает старую почту при первом подключении — только новые письма.",
  "Не хранит лишнее: в базу попадают заголовки, имена вложений и текст, нужный для правил.",
];

export function Honesty() {
  return (
    <section className="bg-white py-16 md:py-24">
      <Reveal className="mx-auto max-w-3xl px-4">
        <h2 className="text-center text-3xl md:text-4xl">Мы уважаем вашу почту</h2>
        <ul className="mt-8 space-y-4">
          {POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3 text-copy">
              <IconCheck className="mt-1 h-6 w-6 shrink-0 text-mint" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-sm text-mist">
          Подробнее — в <Link className="ph-link" href="/privacy">политике конфиденциальности</Link>.
        </p>
      </Reveal>
    </section>
  );
}
