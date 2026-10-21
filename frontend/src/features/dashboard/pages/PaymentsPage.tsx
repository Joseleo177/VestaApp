import { ReactNode, useMemo, useState } from "react";
import { PaymentStatus } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { EmptyBlock } from "@/components/ui/Ledger";
import { Money } from "@/components/ui/Money";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Page } from "@/components/ui/Page";
import { Pagination } from "@/components/ui/Pagination";
import { Segmented } from "@/components/ui/Segmented";
import { usePagination } from "@/lib/usePagination";
import { useResident } from "../hooks/useResident";
import { PaymentRow } from "../components/PaymentRow";
import { RowsSkeleton, SectionCard } from "../components/SectionCard";

type Filter = "all" | PaymentStatus;

/** Historial de pagos del vecino. Cada fila se despliega para ver a qué fue el dinero. */
export function PaymentsPage() {
  const s = useResident();
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c = { [PaymentStatus.PENDING]: 0, [PaymentStatus.REJECTED]: 0 };
    s.payments.forEach((p) => p.status in c && c[p.status as keyof typeof c]++);
    return c;
  }, [s.payments]);

  const list = useMemo(
    () => (filter === "all" ? s.payments : s.payments.filter((p) => p.status === filter)),
    [filter, s.payments]
  );
  const paged = usePagination(list, 15);

  // Las pestañas de estado solo aparecen si hay algo que separar.
  const showFilter = counts[PaymentStatus.PENDING] > 0 || counts[PaymentStatus.REJECTED] > 0;

  // Resumen: lo confirmado del año en curso y el último pago confirmado.
  const year = String(new Date().getFullYear());
  const summary = useMemo(() => {
    const confirmed = s.payments.filter((p) => p.status === PaymentStatus.CONFIRMED);
    const thisYear = confirmed.filter((p) => p.paymentDate.startsWith(year));
    const last = confirmed.reduce<typeof confirmed[number] | null>(
      (best, p) => (!best || p.paymentDate > best.paymentDate ? p : best),
      null
    );
    return { total: thisYear.reduce((sum, p) => sum + Number(p.amount), 0), count: thisYear.length, last };
  }, [s.payments, year]);

  return (
    <Page module="Mi cuenta" title="Mis pagos">
      {!s.loadingPayments && s.payments.length > 0 && (
        <Card className="mb-4 grid grid-cols-2 divide-ios-separator sm:grid-cols-3 sm:divide-x">
          <Stat label={`Pagado en ${year}`}>
            <Money value={formatCurrency(summary.total)} className="text-[20px] font-bold text-ios-label" />
            <span className="block text-[12px] text-ios-secondary">
              {summary.count} {summary.count === 1 ? "pago confirmado" : "pagos confirmados"}
            </span>
          </Stat>
          <Stat label="Último pago">
            {summary.last ? (
              <>
                <span className="block text-[20px] font-bold tabular-nums text-ios-label">
                  {formatDate(summary.last.paymentDate)}
                </span>
                <Money value={formatCurrency(summary.last.amount)} className="block text-[12px] text-ios-secondary" />
              </>
            ) : (
              <span className="block text-[20px] font-bold text-ios-label">—</span>
            )}
          </Stat>
          <Stat label="En revisión" className="col-span-2 border-t border-ios-separator sm:col-span-1 sm:border-t-0">
            <span
              className={cn(
                "block text-[20px] font-bold tabular-nums",
                counts[PaymentStatus.PENDING] ? "text-ios-blue" : "text-ios-label"
              )}
            >
              {counts[PaymentStatus.PENDING]}
            </span>
            <span className="block text-[12px] text-ios-secondary">
              {counts[PaymentStatus.PENDING] ? "Esperando confirmación" : "Nada pendiente"}
            </span>
          </Stat>
        </Card>
      )}

      <SectionCard
        title="Pagos registrados"
        subtitle={s.loadingPayments ? "Cargando…" : "Toca un pago para ver a qué cuotas se aplicó y bajar su recibo"}
        aside={
          showFilter && (
            <Segmented
              aria-label="Filtrar pagos"
              value={filter}
              onChange={setFilter}
              options={[
                { key: "all", label: "Todos", count: s.payments.length },
                ...(counts[PaymentStatus.PENDING]
                  ? [{ key: PaymentStatus.PENDING as Filter, label: "En revisión", count: counts[PaymentStatus.PENDING] }]
                  : []),
                ...(counts[PaymentStatus.REJECTED]
                  ? [{ key: PaymentStatus.REJECTED as Filter, label: "Rechazados", count: counts[PaymentStatus.REJECTED] }]
                  : []),
              ]}
            />
          )
        }
      >
        {s.loadingPayments ? (
          <RowsSkeleton rows={5} />
        ) : list.length === 0 ? (
          <EmptyBlock
            title="Aún no registras pagos"
            hint="Cuando pagues una cuota desde Mis cuotas, el pago aparecerá aquí con su estado."
          />
        ) : (
          <ul className="divide-y divide-ios-separator">
            {paged.items.map((p) => (
              <PaymentRow key={p.id} payment={p} multiUnit={s.multiUnit} />
            ))}
          </ul>
        )}
        <Pagination
          page={paged.page}
          totalPages={paged.totalPages}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          onPageChange={paged.setPage}
          label="pagos"
        />
      </SectionCard>
    </Page>
  );
}

function Stat({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("px-5 py-4", className)}>
      <p className="mb-0.5 text-[12px] font-medium text-ios-secondary">{label}</p>
      {children}
    </div>
  );
}
