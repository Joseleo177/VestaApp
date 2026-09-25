import { CalendarDays, RefreshCw } from "lucide-react";
import { useExchangeRate } from "@/features/exchange-rate/hooks/useExchangeRate";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { formatRate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { RateCurrency } from "@/types/domain";

const SYMBOL: Record<RateCurrency, string> = { USD: "$", EUR: "€" };

/**
 * Píldora central: fecha de hoy + tasas BCV activas con refresco manual.
 * La principal va destacada; si solo hay una activa se muestra sola.
 */
export function ExchangeRatePill() {
  const { data, loading, refresh } = useExchangeRate();
  const { isAdmin } = useAuth();

  const today = new Date().toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Principal primero.
  const rates = data
    ? [...data.rates].sort((a, b) =>
        a.currency === data.primary ? -1 : b.currency === data.primary ? 1 : 0
      )
    : [];

  return (
    <div className="flex items-center gap-3 rounded-full bg-ios-fill px-4 py-1.5 text-[13px]">
      <span className="hidden items-center gap-1.5 text-ios-secondary sm:flex">
        <CalendarDays className="h-4 w-4" />
        {today}
      </span>
      <span className="hidden h-3.5 w-px bg-ios-tertiary sm:block" />
      {rates.length === 0 ? (
        <span className="flex items-center gap-1.5">
          <span className="text-ios-secondary">BCV:</span>
          <span className="font-semibold text-ios-green">—</span>
        </span>
      ) : (
        rates.map((r) => {
          const isPrimary = r.currency === data?.primary;
          return (
            <span
              key={r.currency}
              className="flex items-center gap-1"
              title={`Tasa BCV ${r.currency}${isPrimary ? " (principal)" : ""}`}
            >
              <span className="text-ios-secondary">{SYMBOL[r.currency]}</span>
              <span
                className={cn(
                  "font-semibold",
                  isPrimary ? "text-ios-green" : "text-ios-secondary"
                )}
              >
                {formatRate(r.rate)}
              </span>
            </span>
          );
        })
      )}
      {isAdmin && (
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="text-ios-secondary transition-colors hover:text-ios-label disabled:opacity-50"
          aria-label="Actualizar tasas"
          title="Actualizar tasas BCV"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      )}
    </div>
  );
}
