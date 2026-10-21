import { useState } from "react";
import { Upload } from "lucide-react";
import { PaymentStatus } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Page } from "@/components/ui/Page";
import { Pagination } from "@/components/ui/Pagination";
import { SearchField } from "@/components/ui/SearchField";
import { Segmented } from "@/components/ui/Segmented";
import { PaymentDetailModal } from "@/features/admin-panel/components/PaymentDetailModal";
import { PaymentImportModal } from "../components/PaymentImportModal";
import { PaymentsTable } from "../components/PaymentsTable";
import { StatusFilter, useAllPaymentsLogic } from "../hooks/useAllPaymentsLogic";

/** Todos los pagos de la asociación: validar lo pendiente y consultar lo demás. */
export function AllPaymentsPage() {
  const s = useAllPaymentsLogic();
  const [importOpen, setImportOpen] = useState(false);
  const hasQuery = s.search.trim() !== "";

  return (
    <Page
      module="Día a día"
      title="Pagos"
      actions={
        <Button size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Registrar pagos en lote</span>
          <span className="sm:hidden">En lote</span>
        </Button>
      }
    >
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ios-separator p-4 lg:flex-row lg:items-center">
          <div className="no-scrollbar -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            <Segmented<StatusFilter>
              aria-label="Estado del pago"
              value={s.status}
              onChange={s.setStatus}
              options={[
                { key: PaymentStatus.PENDING, label: "Por validar", count: s.counts.PENDING },
                { key: PaymentStatus.CONFIRMED, label: "Confirmados", count: s.counts.CONFIRMED },
                { key: PaymentStatus.REJECTED, label: "Rechazados", count: s.counts.REJECTED },
                { key: "ALL", label: "Todos", count: s.counts.ALL },
              ]}
            />
          </div>
          <SearchField
            value={s.search}
            onChange={s.setSearch}
            placeholder="Vecino, depto., referencia o mes"
            className="lg:ml-auto lg:w-80"
            hotkey
          />
        </div>

        {hasQuery && !s.loading && (
          <p className="border-b border-ios-separator px-5 py-2 text-[12px] text-ios-secondary">
            {s.filtered.length} {s.filtered.length === 1 ? "pago coincide" : "pagos coinciden"} con «{s.search.trim()}»
          </p>
        )}

        <PaymentsTable
          payments={s.paged.items}
          loading={s.loading}
          hasQuery={hasQuery}
          onClear={() => s.setSearch("")}
          ownerName={s.ownerName}
          busyId={s.busyId}
          onOpen={s.open}
          onConfirm={s.confirm}
          onReject={s.setRejectTarget}
          onDelete={s.setDeleteTarget}
        />

        <Pagination
          page={s.paged.page}
          totalPages={s.paged.totalPages}
          total={s.paged.total}
          from={s.paged.from}
          to={s.paged.to}
          onPageChange={s.paged.setPage}
          label="pagos"
        />
      </Card>

      <PaymentDetailModal
        payment={s.selected}
        open={!!s.selected}
        onClose={s.close}
        ownerName={s.selected ? s.ownerName(s.selected) : undefined}
        onResolved={() => {
          s.close();
          void s.reload();
        }}
        onDelete={s.setDeleteTarget}
      />

      {s.settledDialog}

      <PaymentImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => void s.reload()} />

      <ConfirmDialog
        open={s.deleteTarget !== null}
        onClose={() => s.setDeleteTarget(null)}
        onConfirm={s.remove}
        title="¿Eliminar este pago?"
        description={`El pago de ${s.deleteTarget ? s.ownerName(s.deleteTarget) : "este vecino"}. Si estaba confirmado, sus cuotas vuelven al estado anterior.`}
        confirmLabel="Eliminar"
        loading={s.busyId === s.deleteTarget?.id}
      />

      <ConfirmDialog
        open={s.voidTarget !== null}
        onClose={() => s.setVoidTarget(null)}
        onConfirm={s.voidPayment}
        title="Anular pago y recibos"
        description={`${s.voidTarget?.message ?? ""} Las cuotas vuelven a su estado anterior y el pago queda como anulado en el historial.`}
        confirmLabel="Anular"
        loading={s.busyId === s.voidTarget?.payment.id}
        prompt={{ label: "Motivo de la anulación", placeholder: "Ej. Transferencia registrada dos veces", required: true }}
      />

      <ConfirmDialog
        open={s.rejectTarget !== null}
        onClose={() => s.setRejectTarget(null)}
        onConfirm={s.reject}
        title="Rechazar pago"
        description={`Indica por qué se rechaza el pago de ${s.rejectTarget ? s.ownerName(s.rejectTarget) : ""}. El vecino verá el motivo.`}
        confirmLabel="Rechazar"
        loading={s.busyId === s.rejectTarget?.id}
        prompt={{ label: "Motivo del rechazo", placeholder: "Ej. Referencia no encontrada", required: true }}
      />
    </Page>
  );
}
