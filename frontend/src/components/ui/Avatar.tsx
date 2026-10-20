import { cn } from "@/lib/cn";

export type AvatarTone = "brand" | "violet" | "neutral";

const TONES: Record<AvatarTone, string> = {
  brand: "bg-brand-50 text-brand-700",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  neutral: "bg-ios-fill text-ios-secondary",
};

const SIZES = {
  sm: "h-9 w-9 text-[12px]",
  lg: "h-14 w-14 text-[18px]",
};

/** Dos iniciales del nombre: un ancla visual por fila sin depender de una foto. */
export const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase() || "?";

export function Avatar({
  name,
  tone = "brand",
  size = "sm",
  className,
}: {
  name: string;
  tone?: AvatarTone;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        TONES[tone],
        SIZES[size],
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
