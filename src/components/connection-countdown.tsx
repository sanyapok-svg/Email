"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/mail/next-connection";

export function ConnectionCountdown({ at, initial }: { at: string; initial: string }) {
  const [text, setText] = useState(initial);

  useEffect(() => {
    const due = new Date(at).getTime();
    const tick = () => setText(formatCountdown(due - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [at, initial]);

  return <span>{text}</span>;
}
