import { daysPastDue } from "../dueDays";

const plural = (n: number) => (n === 1 ? "día" : "días");

/**
 * Vencimiento en palabras. El color queda para lo que urge: rojo lo vencido,
 * ámbar lo que vence en tres días o menos; lo demás va en gris.
 */
export function DueLabel({ dueDate }: { dueDate: string }) {
  const d = daysPastDue(dueDate);
  if (d > 0)
    return (
      <span className="whitespace-nowrap font-medium text-red-600 dark:text-red-400">
        Vencida hace {d} {plural(d)}
      </span>
    );
  if (d === 0) return <span className="font-medium text-amber-700 dark:text-amber-400">Vence hoy</span>;
  if (d >= -3)
    return (
      <span className="whitespace-nowrap font-medium text-amber-700 dark:text-amber-400">
        Vence en {-d} {plural(-d)}
      </span>
    );
  return <span className="whitespace-nowrap">Vence en {-d} días</span>;
}

/** Color del filete de una fila según su vencimiento, o nada si no urge. */
export function dueTone(dueDate: string): string | undefined {
  const d = daysPastDue(dueDate);
  if (d > 0) return "bg-red-500";
  if (d >= -3) return "bg-amber-500";
  return undefined;
}
