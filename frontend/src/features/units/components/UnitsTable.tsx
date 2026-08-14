import { Building, Pencil, Receipt } from "lucide-react";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

interface UnitsTableProps {
  units: PropertyWithBalance[];
  loading: boolean;
  onEdit: (unit: PropertyWithBalance) => void;
  onViewCharges: (unit: PropertyWithBalance) => void;
}

export function UnitsTable({ units, loading, onEdit, onViewCharges }: UnitsTableProps) {
  if (loading) {
    return (
      <Card className="overflow-hidden">
        <TableSkeleton rows={5} cols={4} />
      </Card>
    );
  }

  if (units.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Building className="h-7 w-7" />}
          title="Sin departamentos"
          description="Crea el primer departamento y asígnalo a un copropietario."
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
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
            {units.map((unit) => (
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
    </Card>
  );
}
