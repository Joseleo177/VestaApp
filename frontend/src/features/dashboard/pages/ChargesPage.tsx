import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Check } from "@/components/ui/Check";
import { EmptyBlock } from "@/components/ui/Ledger";
import { Money } from "@/components/ui/Money";
import { Page } from "@/components/ui/Page";
import { Pagination } from "@/components/ui/Pagination";
import { Segmented } from "@/components/ui/Segmented";
import { formatCurrency } from "@/lib/format";
import { usePagination } from "@/lib/usePagination";
import { useResident } from "../hooks/useResident";
import { ChargeRow } from "../components/ChargeRow";
import { RowsSkeleton, SectionCard } from "../components/SectionCard";
import { StatementButton } from "../components/StatementButton";

type Filter = "open" | "closed" | "all";

const EMPTY: Record<Filter, { title: string; hint: string }> = {
  open: { title: "No tienes cuotas pendientes", hint: "Cuando se emita la próxima, aparecerá aquí." },
  closed: { title: "Todavía no hay cuotas pagadas", hint: "Cuando la administración confirme un pago, la cuota y su recibo aparecerán aquí." },
  all: { title: "Aún no tienes cuotas", hint: "Las cuotas de tu departamento aparecerán aquí cuando se emitan." },
};

/**
 * Todas las cuotas del vecino, siempre a la vista. Las pendientes se pueden
 * marcar y pagar juntas; las pagadas traen su recibo.
 */
export function ChargesPage() {
  const s = useResident();
  // Sin elección del usuario, abre en lo que importa: lo pendiente si hay.
  const [chosen, setChosen] = useState<Filter | null>(null);
  const filter: Filter = chosen ?? (s.open.length ? "open" : "closed");

  const list = useMemo(
    () => (filter === "open" ? s.open : filter === "closed" ? s.closed : [...s.open, ...s.closed]),
    [filter, s.open, s.closed]
  );
  const paged = usePagination(list, 12);
  const bulk = filter === "open" && s.payable.length > 1;

  return (
    <Page module="Mi cuenta" title="Mis cuotas" actions={<StatementButton />}>
      <SectionCard
        title={filter === "open" ? "Por pagar" : filter === "closed" ? "Pagadas" : "Todas"}
        subtitle={
          s.loadingStatement
            ? "Cargando…"
            : bulk
              ? s.selected.length
                ? `${s.selected.length} de ${s.payable.length} marcadas`
                : "Marca varias para pagarlas juntas"
              : `${list.length} ${list.length === 1 ? "cuota" : "cuotas"}`
        }
        aside={
          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto">
            <Segmented
              aria-label="Filtrar cuotas"
              value={filter}
              onChange={setChosen}
              options={[
                { key: "open", label: "Pendientes", count: s.open.length },
                { key: "closed", label: "Pagadas", count: s.closed.length },
                { key: "all", label: "Todas" },
              ]}
            />
            {bulk && s.selected.length > 0 && (
              <Button size="sm" onClick={s.paySelected}>
                Pagar <Money value={formatCurrency(s.selectedTotal)} />
              </Button>
            )}
          </div>
        }
      >
        {bulk && (
          <div className="flex items-center gap-3 border-b border-ios-separator bg-ios-fill/30 px-5 py-2">
            <Check
              checked={s.allSelected}
              onChange={s.toggleAll}
              title={s.allSelected ? "Quitar todas" : "Marcar todas"}
            />
            <span className="text-[12px] font-medium text-ios-secondary">
              {s.allSelected ? "Quitar todas" : "Marcar todas"}
            </span>
          </div>
        )}

        {s.loadingStatement ? (
          <RowsSkeleton rows={5} />
        ) : list.length === 0 ? (
          <EmptyBlock {...EMPTY[filter]} />
        ) : (
          <ul className="divide-y divide-ios-separator">
            {paged.items.map((c) => (
              <ChargeRow
                key={c.id}
                charge={c}
                multiUnit={s.multiUnit}
                onPay={s.payOne}
                check={
                  bulk
                    ? { checked: s.selected.some((x) => x.id === c.id), onToggle: () => s.toggle(c.id) }
                    : undefined
                }
              />
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
          label="cuotas"
        />
      </SectionCard>
    </Page>
  );
}
