import { cn } from "@/lib/cn";

/**
 * Monto ya formateado ("REF 1.234,56", "Bs. 120,00", "-REF 3,00") con el prefijo
 * de moneda atenuado y la cifra en dígitos tabulares. En una columna lo que se
 * compara son las cifras: el "REF" repetido con el mismo peso competía con ellas.
 * Un signo delante del prefijo pasa a la cifra: "-REF 3,00" se lee "REF -3,00".
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
