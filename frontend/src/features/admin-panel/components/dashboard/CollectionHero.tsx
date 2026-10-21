import { Link } from "react-router-dom";
import { ArrowRight, Check, Receipt } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatPeriod } from "@/lib/format";

interface CollectionHeroProps {
  loading: boolean;
  period: string | null;
  collection: {
    emitted: number;
    collected: number;
    remaining: number;
    ratio: number;
    units: number;
    paidUnits: number;
  };
}

/**
 * La cifra con la que abre el panel: cuánto del último período ya entró. Un solo
 * número grande y una barra; el resto es contexto en letra chica.
 */
export function CollectionHero({ loading, period, collection: c }: CollectionHeroProps) {
  if (loading) {
    return (
      <Card className="space-y-5 p-6">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-12 w-32 !rounded-xl" />
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-10 w-full !rounded-xl" />
      </Card>
    );
  }

  if (!period) {
    return (
      <Card className="flex flex-col items-start gap-4 p-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Receipt className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[18px] font-semibold text-ios-label">Aún no has emitido cuotas</h2>
          <p className="mt-1 text-[14px] text-ios-secondary">
            Emite las cuotas del mes y aquí verás cuánto se ha cobrado.
          </p>
        </div>
        <Link
          to="/admin/gasto-comun"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-[14px] font-semibold text-white hover:brightness-95"
        >
          Emitir cuotas <ArrowRight className="h-4 w-4" />
        </Link>
      </Card>
    );
  }

  const pct = Math.round(c.ratio * 100);
  const done = c.remaining <= 0.005 && c.emitted > 0;

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-ios-secondary">Cobranza de {formatPeriod(period)}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[56px] font-bold leading-none tracking-[-0.03em] text-ios-label">{pct}%</span>
            <span className="text-[15px] font-medium text-ios-secondary">cobrado</span>
          </div>
        </div>
        <Link
          to="/admin/gasto-comun"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold text-brand-600 transition-colors hover:bg-brand-50"
        >
          Ver cobros <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Medidor: el riel es un paso claro de la misma marca, así el avance se lee en toda la barra. */}
      <div
        className="mt-6 h-2.5 overflow-hidden rounded-full bg-brand-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Cobrado ${pct}% de ${formatPeriod(period)}`}
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-700 ease-out"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="mt-2 text-[13px] text-ios-secondary">
        <Money value={formatCurrency(c.collected)} className="font-semibold text-ios-label" /> de{" "}
        <Money value={formatCurrency(c.emitted)} /> emitidos
      </p>

      <dl className="mt-auto grid grid-cols-2 gap-3 pt-6">
        <div className="rounded-xl bg-ios-fill/60 px-4 py-3">
          <dt className="text-[12px] text-ios-secondary">Por cobrar</dt>
          <dd className="mt-0.5 text-[17px] font-semibold text-ios-label">
            {done ? (
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                Nada
              </span>
            ) : (
              <Money value={formatCurrency(c.remaining)} />
            )}
          </dd>
        </div>
        <div className="rounded-xl bg-ios-fill/60 px-4 py-3">
          <dt className="text-[12px] text-ios-secondary">Departamentos que pagaron</dt>
          <dd className="mt-0.5 text-[17px] font-semibold text-ios-label">
            {c.paidUnits} <span className="text-[14px] font-medium text-ios-secondary">de {c.units}</span>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
