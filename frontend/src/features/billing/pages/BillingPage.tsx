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
        <h1 className="text-[28px] font-bold leading-tight text-ios-label">Cuotas de la asociación</h1>
        <p className="text-sm text-ios-secondary">
          Emite la cuota fija del mes para todos los departamentos y gestiona
          exoneraciones.
        </p>
      </div>

      <GenerateChargesForm onGenerated={refetch} />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ios-label">
          Períodos emitidos
        </h2>
        <p className="mb-3 text-xs text-ios-secondary">
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
