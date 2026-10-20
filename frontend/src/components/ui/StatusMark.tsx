import { Ban, Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Estado de un registro en un listado.
 *
 * El color es una señal, no un adorno: si casi todos están al día, una pastilla
 * verde en cada fila convierte el color en ruido y el moroso se pierde entre
 * cincuenta verdes. El estado "normal" (`quiet`) va en gris con un icono; solo lo
 * que pide atención lleva color y punto.
 *
 * Los tonos de texto son un paso más oscuros que los semánticos del tema: el rojo
 * y el verde de iOS sobre blanco no llegan a 4.5:1 en texto de 12px.
 */
export type Tone = "success" | "warning" | "danger" | "info" | "violet" | "neutral";

const TONES: Record<Tone, { text: string; dot: string; ring: string }> = {
  success: { text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", ring: "ring-emerald-500/20" },
  warning: { text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500", ring: "ring-amber-500/20" },
  danger: { text: "text-red-600 dark:text-red-400", dot: "bg-red-500", ring: "ring-red-500/20" },
  info: { text: "text-sky-700 dark:text-sky-400", dot: "bg-sky-500", ring: "ring-sky-500/20" },
  violet: { text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-500", ring: "ring-violet-500/20" },
  neutral: { text: "text-ios-secondary", dot: "bg-ios-tertiary", ring: "ring-ios-tertiary/30" },
};

export interface StatusDef {
  label: string;
  tone: Tone;
  /** Estado normal: gris con un visto (`check`) o un círculo tachado (`void`). */
  quiet?: "check" | "void";
}

export function StatusMark({ label, tone, quiet, className }: StatusDef & { className?: string }) {
  const t = TONES[tone];

  if (quiet) {
    const Icon = quiet === "check" ? Check : Ban;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-ios-secondary",
          className
        )}
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", quiet === "check" && t.text)} strokeWidth={2.5} />
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap text-[12px] font-semibold",
        t.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full ring-4", t.dot, t.ring)} />
      {label}
    </span>
  );
}
