import { RefreshCw } from "lucide-react";
import { useExchangeRate } from "@/features/exchange-rate/hooks/useExchangeRate";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { formatRate } from "@/lib/format";
import { cn } from "@/lib/cn";

const updatedAt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

/**
 * Fecha de hoy y tasas BCV activas. La principal va en tinta y la otra en gris:
 * antes la principal iba en verde, y el verde en esta app significa "al día".
 * El código de la moneda va escrito: "€" y "$" solos obligaban a adivinar.
 */
export function ExchangeRatePill({ className }: { className?: string }) {
  const { data, loading, refresh } = useExchangeRate();
  const { isAdmin } = useAuth();

  const today = new Date().toLocaleDateString("es-VE", { weekday: "short", day: "numeric", month: "short" });
  const rates = data
    ? [...data.rates].sort((a, b) => (a.currency === data.primary ? -1 : b.currency === data.primary ? 1 : 0))
    : [];
  const last = updatedAt(rates[0]?.updatedAt ?? rates[0]?.fetchedAt);

  return (
    <div
      className={cn(
        "flex h-9 items-center gap-3 rounded-full border border-ios-separator bg-ios-card/60 pl-3.5 pr-1.5 text-[13px]",
        className
      )}
      title={last ? `Tasas BCV · actualizadas el ${last}` : "Tasas BCV"}
    >
      <span className="hidden capitalize text-ios-secondary sm:inline">{today}</span>
      <span className="hidden h-4 w-px bg-ios-separator sm:block" aria-hidden />
      <span className="rounded-md bg-ios-fill px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ios-secondary">
        BCV
      </span>
      {rates.length === 0 ? (
        <span className="text-ios-secondary">{loading ? "Cargando…" : "Sin tasa"}</span>
      ) : (
        rates.map((r) => {
          const primary = r.currency === data?.primary;
          return (
            <span key={r.currency} className="flex items-baseline gap-1 tabular-nums">
              <span className="text-[11px] font-semibold text-ios-secondary">{r.currency}</span>
              <span className={cn(primary ? "font-semibold text-ios-label" : "text-ios-secondary")}>
                {formatRate(r.rate)}
              </span>
            </span>
          );
        })
      )}
      {isAdmin ? (
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="flex h-7 w-7 items-center justify-center rounded-full text-ios-secondary transition-colors hover:bg-ios-fill hover:text-ios-label disabled:opacity-50"
          aria-label="Actualizar tasas BCV"
          title="Actualizar tasas BCV"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      ) : (
        <span className="w-1.5" />
      )}
    </div>
  );
}
