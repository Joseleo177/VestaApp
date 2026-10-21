import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Tower } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Page } from "@/components/ui/Page";
import { Skeleton } from "@/components/ui/Skeleton";
import { Money } from "@/components/ui/Money";
import { formatCurrency } from "@/lib/format";
import { ApiError } from "@/services/api";
import { useTowersOverview } from "../hooks/useTowersOverview";
import { NewTowerCard, TowerCard } from "../components/TowerCard";
import { TowerFormModal } from "../components/TowerFormModal";
import { towerService } from "../services/tower.service";

/** Torres o bloques de la asociación, cada una con su estado de cobranza. */
export function TowersPage() {
  const { stats, unassigned, loading, refetch } = useTowersOverview();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tower | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tower | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totals = stats.reduce(
    (acc, s) => ({ units: acc.units + s.units, debt: acc.debt + s.debt }),
    { units: 0, debt: 0 }
  );

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (tower: Tower) => {
    setEditing(tower);
    setModalOpen(true);
  };
  const handleSaved = () => {
    setModalOpen(false);
    setEditing(null);
    void refetch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await towerService.remove(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" eliminada`);
      setDeleteTarget(null);
      void refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Page
      module="Asociación"
      title="Torres"
      actions={
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva torre
        </Button>
      }
      subheader={
        !loading && stats.length > 0 ? (
          <p className="text-[14px] text-ios-secondary">
            {stats.length} {stats.length === 1 ? "torre" : "torres"} · {totals.units} departamentos
            {totals.debt > 0 && (
              <>
                {" · "}
                <Money value={formatCurrency(totals.debt)} className="font-semibold text-ios-label" /> por cobrar
              </>
            )}
          </p>
        ) : undefined
      }
    >
      {unassigned > 0 && !loading && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-[13px] text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">
              {unassigned} {unassigned === 1 ? "departamento no tiene" : "departamentos no tienen"} torre.
            </span>{" "}
            No entrarán en la emisión de cuotas filtrada por torre.{" "}
            <Link to="/admin/departamentos" className="font-semibold underline underline-offset-2">
              Asignarlos
            </Link>
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 !rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-14 w-full !rounded-xl" />
              <Skeleton className="h-2 w-full" />
            </Card>
          ))
        ) : (
          <>
            {stats.map((s) => (
              <TowerCard
                key={s.tower.id}
                stats={s}
                onEdit={() => openEdit(s.tower)}
                onDelete={() => setDeleteTarget(s.tower)}
              />
            ))}
            <NewTowerCard onClick={openCreate} />
          </>
        )}
      </div>

      <TowerFormModal
        open={modalOpen}
        tower={editing}
        units={stats.find((s) => s.tower.id === editing?.id)?.units ?? 0}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`¿Eliminar "${deleteTarget?.name ?? ""}"?`}
        description="La torre no tiene departamentos asignados. Esta acción no se puede deshacer."
        confirmLabel="Eliminar torre"
        loading={deleting}
      />
    </Page>
  );
}
