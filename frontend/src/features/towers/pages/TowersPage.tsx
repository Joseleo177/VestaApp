import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tower } from "@/types/domain";
import { useTowers } from "../hooks/useTowers";
import { TowersTable } from "../components/TowersTable";
import { TowerFormModal } from "../components/TowerFormModal";

export function TowersPage() {
  const { towers, loading, refetch } = useTowers();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tower | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Torres</h1>
          <p className="text-sm text-slate-500">
            Bloques o torres del condominio. Se usan para filtrar la emisión de cuotas.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nueva torre
        </Button>
      </div>

      <TowersTable towers={towers} loading={loading} onEdit={openEdit} onDeleted={refetch} />

      <TowerFormModal
        open={modalOpen}
        tower={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
