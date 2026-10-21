import { useState } from "react";
import { Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalIcon } from "@/components/ui/Modal";
import { Money } from "@/components/ui/Money";
import { Page } from "@/components/ui/Page";
import { formatCurrency } from "@/lib/format";
import { ChargeType } from "@/types/domain";
import { usePeriods } from "../hooks/usePeriods";
import { GenerateChargesForm } from "../components/GenerateChargesForm";
import { PeriodsTable } from "../components/PeriodsTable";
import { PeriodChargesModal } from "../components/PeriodChargesModal";

/** Cobros: emitir las cuotas del mes y seguir la cobranza de cada período. */
export function BillingPage() {
  const { periods, loading, refetch } = usePeriods();
  const [selected, setSelected] = useState<{ period: string; type: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const pending = periods.reduce(
    (s, p) => s + (p.progress ? Math.max(0, p.progress.billable - p.progress.collected) : 0),
    0
  );

  const handleGenerated = () => {
    setFormOpen(false);
    void refetch();
  };

  return (
    <Page
      module="Día a día"
      title="Cobros"
      actions={
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Emitir cuotas
        </Button>
      }
      subheader={
        !loading && periods.length > 0 ? (
          <p className="text-[14px] text-ios-secondary">
            {periods.length} {periods.length === 1 ? "período emitido" : "períodos emitidos"}
            {pending > 0.005 ? (
              <>
                {" · "}
                <Money value={formatCurrency(pending)} className="font-semibold text-ios-label" /> por cobrar en total.
                Toca un período para ver sus cuotas, exonerar o condonar.
              </>
            ) : (
              " · todo cobrado."
            )}
          </p>
        ) : undefined
      }
    >
      <PeriodsTable
        periods={periods}
        loading={loading}
        onSelect={(period, type) => setSelected({ period, type })}
        onDeleted={refetch}
        onCreate={() => setFormOpen(true)}
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        className="sm:max-w-2xl"
        title="Emitir cuotas"
        description="Crea la cuota del período para los departamentos que elijas."
        icon={
          <ModalIcon tone="bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400">
            <Receipt className="h-5 w-5" />
          </ModalIcon>
        }
      >
        <GenerateChargesForm
          onGenerated={handleGenerated}
          onCancel={() => setFormOpen(false)}
          emittedPeriods={periods.filter((p) => p.type === ChargeType.REGULAR).map((p) => p.period)}
        />
      </Modal>

      <PeriodChargesModal
        period={selected?.period ?? null}
        type={selected?.type ?? null}
        open={!!selected}
        onClose={() => setSelected(null)}
        onChanged={refetch}
      />
    </Page>
  );
}
