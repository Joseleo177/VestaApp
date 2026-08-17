import { useMemo, useState } from "react";
import { Search, Building } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { usePagination } from "@/lib/usePagination";
import { DelinquencyFilter, PropertyWithBalance } from "../types";

interface DelinquencyTableProps {
  properties: PropertyWithBalance[];
  loading: boolean;
}

const FILTERS: { value: DelinquencyFilter; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "CURRENT", label: "Al día" },
  { value: "DELINQUENT", label: "Morosos" },
];

/** Control de morosidad: filtra por estado de cuenta y busca por apto/propietario. */
export function DelinquencyTable({ properties, loading }: DelinquencyTableProps) {
  const [filter, setFilter] = useState<DelinquencyFilter>("ALL");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return properties.filter((p) => {
      const matchesFilter =
        filter === "ALL" ||
        (filter === "DELINQUENT" ? p.balance > 0 : p.balance === 0);
      const matchesSearch =
        !term ||
        p.code.toLowerCase().includes(term) ||
        (p.owner?.fullName.toLowerCase().includes(term) ?? false);
      return matchesFilter && matchesSearch;
    });
  }, [properties, filter, search]);

  const paged = usePagination(filtered, 25);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-ios-separator px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg bg-ios-fill p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.value
                  ? "bg-ios-card text-ios-label shadow-ios"
                  : "text-ios-secondary hover:text-ios-label"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ios-secondary" />
          <Input
            placeholder="Buscar por apto o propietario…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building className="h-7 w-7" />}
          title="Sin resultados"
          description="Ninguna propiedad coincide con el filtro o la búsqueda."
        />
      ) : (
        <>
          {/* Vista móvil: tarjetas */}
          <div className="sm:hidden divide-y divide-ios-separator">
            {paged.items.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="font-semibold text-ios-label">{p.code}</p>
                  {p.tower && <p className="text-xs text-ios-secondary">{p.tower.name}</p>}
                  <p className="text-sm text-ios-secondary truncate">{p.owner?.fullName ?? "—"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold text-ios-label">{formatCurrency(p.balance)}</p>
                  <span
                    className={cn(
                      "mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                      p.balance > 0
                        ? "bg-ios-red/10 text-ios-red"
                        : "bg-ios-green/10 text-ios-green"
                    )}
                  >
                    {p.balance > 0 ? "Moroso" : "Al día"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Vista desktop: tabla */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ios-separator text-[11px] font-semibold uppercase tracking-wider text-ios-secondary">
                <tr>
                  <th className="px-5 py-3 font-medium">Propiedad</th>
                  <th className="px-5 py-3 font-medium">Propietario</th>
                  <th className="px-5 py-3 font-medium">Saldo pendiente</th>
                  <th className="px-5 py-3 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ios-separator">
                {paged.items.map((p) => (
                  <tr key={p.id} className="hover:bg-ios-fill">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-ios-label">{p.code}</div>
                      {p.tower && <div className="text-xs text-ios-secondary">{p.tower.name}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-ios-label">{p.owner?.fullName ?? "—"}</td>
                    <td className="px-5 py-3.5 font-semibold text-ios-label">
                      {formatCurrency(p.balance)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          p.balance > 0
                            ? "bg-ios-red/10 text-ios-red"
                            : "bg-ios-green/10 text-ios-green"
                        )}
                      >
                        {p.balance > 0 ? "Moroso" : "Al día"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            from={paged.from}
            to={paged.to}
            onPageChange={paged.setPage}
            label="propiedades"
          />
        </>
      )}
    </Card>
  );
}
