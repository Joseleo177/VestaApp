import { useMemo, useState } from "react";
import { PaymentStatus } from "@/types/domain";
import { EmptyBlock } from "@/components/ui/Ledger";
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

  return (
    <Page module="Mi cuenta" title="Mis pagos">
      <SectionCard
        title="Pagos registrados"
        subtitle={s.loadingPayments ? "Cargando…" : "Toca un pago para ver a qué cuotas se aplicó"}
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
