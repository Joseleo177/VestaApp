import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { MonthIncome } from "../../hooks/useAdminDashboard";

const PLOT_HEIGHT = 170;
const compact = new Intl.NumberFormat("es-VE", { notation: "compact", maximumFractionDigits: 1 });

/** Techo "redondo" del eje: 1, 2, 2,5 o 5 por potencia de 10. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const m = v / exp;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * exp;
}

interface IncomeChartProps {
  loading: boolean;
  months: MonthIncome[];
  thisMonth?: MonthIncome;
  lastMonth?: MonthIncome;
}

/**
 * Ingresos confirmados de los últimos meses, por fecha de pago. Una sola serie:
 * un solo color (el de la marca, validado contra la tarjeta clara y la oscura),
 * sin leyenda, y el valor escrito solo en el mes en curso; el resto, en el
 * tooltip y en la tabla para lectores de pantalla.
 */
export function IncomeChart({ loading, months, thisMonth, lastMonth }: IncomeChartProps) {
  const [hover, setHover] = useState<string | null>(null);
  const max = niceMax(Math.max(...months.map((m) => m.total), 0));
  const ticks = [max, max / 2, 0];

  // Variación contra el mes anterior: subir es bueno (verde), bajar es malo (rojo).
  const delta =
    thisMonth && lastMonth && lastMonth.total > 0 ? (thisMonth.total - lastMonth.total) / lastMonth.total : null;

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ios-label">Ingresos confirmados</h2>
          <p className="text-[12px] text-ios-secondary">Últimos {months.length} meses, por fecha de pago</p>
        </div>
        {!loading && thisMonth && (
          <div className="text-right">
            <p className="text-[12px] text-ios-secondary">Este mes</p>
            <Money value={formatCurrency(thisMonth.total)} className="text-[22px] font-bold text-ios-label" />
            {delta !== null && (
              <p
                className={cn(
                  "mt-0.5 inline-flex items-center gap-0.5 text-[12px] font-semibold",
                  delta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}
              >
                {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {delta >= 0 ? "+" : "−"}
                {Math.abs(Math.round(delta * 100))}% vs. {lastMonth?.label.toLowerCase()}
              </p>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="mt-6 h-[200px] w-full !rounded-xl" />
      ) : (
        <div className="mt-6 flex gap-3">
          {/* Eje Y: tres marcas redondas, compactas desde mil. */}
          <div className="relative w-10 shrink-0 text-right" style={{ height: PLOT_HEIGHT }} aria-hidden>
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute right-0 -translate-y-1/2 text-[11px] tabular-nums text-ios-secondary"
                style={{ top: `${(1 - t / max) * 100}%` }}
              >
                {compact.format(t)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {/* Guías: línea fina, sólida y recesiva. */}
              {ticks.map((t) => (
                <div
                  key={t}
                  aria-hidden
                  className="absolute inset-x-0 h-px bg-ios-separator"
                  style={{ top: `${(1 - t / max) * 100}%` }}
                />
              ))}

              <div className="absolute inset-0 flex items-end">
                {months.map((m) => {
                  const h = (m.total / max) * 100;
                  const on = hover === m.key;
                  return (
                    // La banda entera es el blanco del cursor, no solo la barra.
                    <button
                      key={m.key}
                      type="button"
                      onMouseEnter={() => setHover(m.key)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(m.key)}
                      onBlur={() => setHover(null)}
                      aria-label={`${m.label}: ${formatCurrency(m.total)} en ${m.count} pagos`}
                      className="group relative flex h-full flex-1 items-end justify-center focus:outline-none"
                    >
                      {on && <span aria-hidden className="absolute inset-y-0 inset-x-1 rounded-lg bg-ios-fill/60" />}
                      {/* Valor solo en el mes en curso (el que cuenta la historia). */}
                      {m.current && m.total > 0 && !on && (
                        <span
                          className="absolute z-10 -translate-y-full whitespace-nowrap pb-1.5 text-[11px] font-semibold tabular-nums text-ios-label"
                          style={{ bottom: `${h}%` }}
                        >
                          {compact.format(m.total)}
                        </span>
                      )}
                      <span
                        className="relative w-full max-w-[24px] rounded-t-[4px] bg-brand-600 transition-[height] duration-500 ease-out"
                        style={{ height: m.total > 0 ? `max(${h}%, 2px)` : 0 }}
                      />
                      {on && (
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-ios-label px-3 py-2 text-left text-[12px] text-ios-bg shadow-ios-lg"
                          style={{ bottom: `calc(${h}% + 8px)` }}
                        >
                          <span className="block font-semibold">{m.label}{m.current ? " (en curso)" : ""}</span>
                          <span className="block tabular-nums">{formatCurrency(m.total)}</span>
                          <span className="block opacity-70">
                            {m.count} {m.count === 1 ? "pago" : "pagos"}
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 flex" aria-hidden>
              {months.map((m) => (
                <span
                  key={m.key}
                  className={cn(
                    "flex-1 text-center text-[12px]",
                    m.current ? "font-semibold text-ios-label" : "text-ios-secondary"
                  )}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* La misma información como tabla, para lectores de pantalla. */}
      <table className="sr-only">
        <caption>Ingresos confirmados por mes</caption>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Monto</th>
            <th>Pagos</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.key}>
              <td>{m.label}</td>
              <td>{formatCurrency(m.total)}</td>
              <td>{m.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
