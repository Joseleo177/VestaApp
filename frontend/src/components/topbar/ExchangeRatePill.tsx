import { CalendarDays, RefreshCw } from "lucide-react";
import { useExchangeRate } from "@/features/exchange-rate/hooks/useExchangeRate";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { formatRate } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Píldora central: fecha de hoy + tasa BCV (Bs/USD) con refresco manual. */
export function ExchangeRatePill() {
  const { data, loading, refresh } = useExchangeRate();
  const { isAdmin } = useAuth();

  const today = new Date().toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="flex items-center gap-3 rounded-full bg-ios-fill px-4 py-1.5 text-[13px]">
      <span className="flex items-center gap-1.5 text-ios-secondary">
        <CalendarDays className="h-4 w-4" />
        {today}
      </span>
      <span className="h-3.5 w-px bg-ios-tertiary" />
      <span className="flex items-center gap-1.5">
        <span className="text-ios-secondary">Bs./Ref.:</span>
        <span className="font-semibold text-ios-green">
          {data ? formatRate(data.rate) : "—"}
        </span>
      </span>
      {isAdmin && (
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="text-ios-secondary transition-colors hover:text-ios-label disabled:opacity-50"
          aria-label="Actualizar tasa"
          title="Actualizar tasa BCV"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      )}
    </div>
  );
}
