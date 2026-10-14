import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "text";

export function Button({
  variant = "primary",
  block = false,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean; children: ReactNode }) {
  return (
    <button className={classNames("ph-btn", variantClass(variant), block ? "ph-btn-block" : "", className)} {...props}>
      {children}
    </button>
  );
}

export function variantClass(variant: Variant): string {
  if (variant === "ghost") return "ph-btn-ghost";
  if (variant === "text") return "ph-btn-text";
  return "ph-btn-primary";
}

function classNames(...parts: string[]) {
  return parts.filter(Boolean).join(" ");
}
