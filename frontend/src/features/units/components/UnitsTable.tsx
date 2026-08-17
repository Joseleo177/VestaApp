import { useMemo, useState } from "react";
import { Building, Pencil, Receipt, Search } from "lucide-react";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { matchesTerm } from "@/lib/search";
import { usePagination } from "@/lib/usePagination";

interface UnitsTableProps {
  units: PropertyWithBalance[];
  loading: boolean;
  onEdit: (unit: PropertyWithBalance) => void;
  onViewCharges: (unit: PropertyWithBalance) => void;
}

export function UnitsTable({ units, loading, onEdit, onViewCharges }: UnitsTableProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      units.filter((unit) =>
        matchesTerm(search, [
          unit.code,
          unit.tower?.name,
          unit.owner?.fullName,
          unit.authorized?.fullName,
        ])
      ),
    [units, search]
  );

  const paged = usePagination(filtered, 25);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-ios-separator px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ios-secondary">
          {search.trim()
            ? `${filtered.length} de ${units.length} departamentos`
            : `${units.length} departamentos`}
        </p>
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ios-secondary" />
          <Input
            placeholder="Buscar por apto, torre, copropietario…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : units.length === 0 ? (
        <EmptyState
          icon={<Building className="h-7 w-7" />}
          title="Sin departamentos"
          description="Crea el primer departamento y asígnalo a un copropietario."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-7 w-7" />}
          title="Sin resultados"
          description={`Ningún departamento coincide con “${search.trim()}”.`}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ios-separator text-[11px] font-semibold uppercase tracking-wider text-ios-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Departamento</th>
                <th className="px-5 py-3 font-medium">Copropietario</th>
                <th className="px-5 py-3 font-medium">Autorizado</th>
                <th className="px-5 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ios-separator">
              {paged.items.map((unit) => (
                <tr key={unit.id} className="hover:bg-ios-fill">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-ios-label">{unit.code}</div>
                    {unit.tower && (
                      <div className="text-xs text-ios-secondary">{unit.tower.name}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-ios-label">{unit.owner?.fullName ?? "—"}</td>
                  <td className="px-5 py-3.5 text-ios-label">
                    {unit.authorized ? (
                      <>
                        {unit.authorized.fullName}
                        {unit.authorized.id === unit.owner?.id && (
                          <div className="text-xs text-ios-secondary">mismo titular</div>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => onViewCharges(unit)}>
                        <Receipt className="h-4 w-4" /> Cuotas
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onEdit(unit)}>
                        <Pencil className="h-4 w-4" /> Editar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <Pagination
          page={paged.page}
          totalPages={paged.totalPages}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          onPageChange={paged.setPage}
          label="departamentos"
        />
      )}
    </Card>
  );
}