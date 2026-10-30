import { cn } from "@/lib/cn";

/**
 * Monto ya formateado ("1.234,56", "Bs. 120,00", "-Bs. 3,00"): el prefijo de
 * moneda, si lo trae, va atenuado y la cifra en dígitos tabulares. En una columna lo que se
 * compara son las cifras: el prefijo repetido con el mismo peso competía con ellas.
 * Un signo delante del prefijo pasa a la cifra: "-Bs. 3,00" se lee "Bs. -3,00".
 */
export function Money({ value, className }: { value: string; className?: string }) {
  const m = value.match(/^([+\-−]?)\s*([^\d+\-−]+?)\s*([+\-−]?\d.*)$/);
  const cls = cn("whitespace-nowrap tabular-nums", className);
  if (!m) return <span className={cls}>{value}</span>;
  return (
    <span className={cls}>
      <span className="mr-1 text-[0.78em] font-medium opacity-60">{m[2].trim()}</span>
      {m[1]}
      {m[3]}
    </span>
  );
}
