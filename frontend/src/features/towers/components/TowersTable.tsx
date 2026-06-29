import { Pencil, Trash2, Building2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Tower } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/services/api";
import { towerService } from "../services/tower.service";

interface TowersTableProps {
  towers: Tower[];
  loading: boolean;
  onEdit: (tower: Tower) => void;
  onDeleted: () => void;
}

export function TowersTable({ towers, loading, onEdit, onDeleted }: TowersTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (tower: Tower) => {
    if (!confirm(`¿Eliminar "${tower.name}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(tower.id);
    try {
      await towerService.remove(tower.id);
      toast.success(`Torre "${tower.name}" eliminada`);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <TableSkeleton rows={3} cols={3} />
      </Card>
    );
  }

  if (towers.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Building2 className="h-7 w-7" />}
          title="Sin torres registradas"
          description="Crea la primera torre o bloque del condominio."
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Torre / Bloque</th>
              <th className="px-5 py-3 font-medium">Descripción</th>
              <th className="px-5 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {towers.map((tower) => (
              <tr key={tower.id} className="hover:bg-slate-50/60">
                <td className="px-5 py-3.5 font-medium text-slate-800">{tower.name}</td>
                <td className="px-5 py-3.5 text-slate-500">{tower.description ?? "—"}</td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => onEdit(tower)}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(tower)}
                      disabled={deletingId === tower.id}
                      className="text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
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
