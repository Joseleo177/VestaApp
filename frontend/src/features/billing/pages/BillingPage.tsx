import { useState } from "react";
import { usePeriods } from "../hooks/usePeriods";
import { GenerateChargesForm } from "../components/GenerateChargesForm";
import { PeriodsTable } from "../components/PeriodsTable";
import { PeriodChargesModal } from "../components/PeriodChargesModal";

/** Módulo de gasto común: emitir la cuota del mes, ver y exonerar cuotas. */
export function BillingPage() {
  const { periods, loading, refetch } = usePeriods();
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Cuotas de condominio</h1>
        <p className="text-sm text-slate-500">
          Emite la cuota fija del mes para todos los departamentos y gestiona
          exoneraciones.
        </p>
      </div>

      <GenerateChargesForm onGenerated={refetch} />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">
          Períodos emitidos
        </h2>
        <p className="mb-3 text-xs text-slate-400">
          Haz clic en un período para ver sus cuotas y exonerar departamentos.
        </p>
        <PeriodsTable periods={periods} loading={loading} onSelect={setSelectedPeriod} onDeleted={refetch} />
      </div>

      <PeriodChargesModal
        period={selectedPeriod}
        open={!!selectedPeriod}
        onClose={() => setSelectedPeriod(null)}
      />
    </div>
  );
}
