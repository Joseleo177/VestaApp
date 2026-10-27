import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { RateCurrency } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { formatDate, formatRate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ExchangeRate, ExchangeRateRecord } from "../services/exchange-rate.service";

export const CURRENCY_NAME: Record<RateCurrency, string> = { USD: "Dólar", EUR: "Euro" };
export const CURRENCY_SYMBOL: Record<RateCurrency, string> = { USD: "$", EUR: "€" };

/** Cambio porcentual entre dos tasas, o null si no hay con qué comparar. */
export const pctChange = (now?: number, before?: number) =>
  now && before ? ((now - before) / before) * 100 : null;

/**
 * Variación diaria. Para el administrador la tasa no "sube bien" ni "baja mal":
 * es un dato, así que va en tinta con su flecha, sin verde ni rojo.
 */
export function Delta({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return null;
  const flat = Math.abs(value) < 0.005;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums text-ios-secondary", className)}>
      <Icon className="h-3.5 w-3.5" />
      {flat ? "0,00" : `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString("es-VE", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`}%
    </span>
  );
}

/**
 * Línea de tendencia: una sola serie en el color de la marca (validado contra la
 * tarjeta clara y la oscura), sin ejes; el último punto marcado. Es contexto de la
 * cifra grande, no un gráfico para leer valores.
 */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 160;
  const h = 44;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 8) + 4, h - 6 - ((v - min) / span) * (h - 12)]);
  const last = pts[pts.length - 1];
  return (
    // Ancho fluido hasta 160px: en un teléfono la cifra grande se lleva casi toda la
    // fila y la línea se achica en proporción en vez de empujar la tarjeta.
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full max-w-[160px] overflow-visible" aria-hidden>
      <polyline
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-brand-600"
      />
      <circle cx={last[0]} cy={last[1]} r={4} className="fill-brand-600 stroke-ios-card" strokeWidth={2} />
    </svg>
  );
}

interface RateCardProps {
  currency: RateCurrency;
  current: ExchangeRate | null;
  /** Historial de esta moneda, del más reciente al más viejo. */
  history: ExchangeRateRecord[];
  primary: boolean;
  enabled: boolean;
}

export function RateCard({ currency, current, history, primary, enabled }: RateCardProps) {
  const previous = history.find((h) => h.date < (history[0]?.date ?? "")) ?? history[1];
  const change = pctChange(current?.rate ?? history[0]?.rate, previous?.rate);
  const trend = history.slice(0, 14).map((h) => Number(h.rate)).reverse();

  return (
    <Card className={cn("flex flex-col p-5", !enabled && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-500/[0.14] text-[16px] font-bold text-lime-700 dark:text-lime-400">
            {CURRENCY_SYMBOL[currency]}
          </span>
          <div>
            <p className="text-[14px] font-semibold text-ios-label">
              {CURRENCY_NAME[currency]} <span className="font-normal text-ios-secondary">· BCV</span>
            </p>
            <p className="text-[12px] text-ios-secondary">
              {enabled ? (primary ? "Moneda principal" : "Activa") : "Desactivada"}
            </p>
          </div>
        </div>
        {primary && (
          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Principal</span>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="shrink-0">
          <p className="text-[34px] font-bold leading-none tracking-tight text-ios-label">
            {current ? formatRate(current.rate) : history[0] ? formatRate(Number(history[0].rate)) : "—"}
            <span className="ml-1.5 text-[14px] font-medium text-ios-secondary">Bs/{currency}</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Delta value={change} />
            {previous && <span className="text-[12px] text-ios-secondary">vs. {formatDate(previous.date)}</span>}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 justify-end">
          <Sparkline values={trend} />
        </div>
      </div>

      <p className="mt-4 border-t border-ios-separator pt-3 text-[12px] text-ios-secondary">
        {current
          ? `Fuente: ${current.source === "MANUAL" ? "registrada a mano" : current.source} · actualizada el ${new Date(
              current.updatedAt ?? current.fetchedAt
            ).toLocaleString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
          : enabled
            ? "Sin tasa vigente: actualízala desde el BCV."
            : "No se consulta al BCV mientras esté desactivada."}
      </p>
    </Card>
  );
}
