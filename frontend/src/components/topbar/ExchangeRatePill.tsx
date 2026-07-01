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
    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm">
      <span className="flex items-center gap-1.5 text-slate-300">
        <CalendarDays className="h-4 w-4" />
        {today}
      </span>
      <span className="h-4 w-px bg-white/15" />
      <span className="flex items-center gap-1.5 text-slate-200">
        <span className="text-slate-400">Bs./Ref.:</span>
        <span className="font-semibold text-emerald-400">
          {data ? formatRate(data.rate) : "—"}
        </span>
      </span>
      {isAdmin && (
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="text-slate-400 transition-colors hover:text-white disabled:opacity-50"
          aria-label="Actualizar tasa"
          title="Actualizar tasa BCV"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      )}
    </div>
  );
}
