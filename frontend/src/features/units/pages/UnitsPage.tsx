import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { useUnits } from "../hooks/useUnits";
import { UnitsTable } from "../components/UnitsTable";
import { UnitFormModal } from "../components/UnitFormModal";
import { PropertyChargesModal } from "../components/PropertyChargesModal";

export function UnitsPage() {
  const { units, owners, authorizedCandidates, loading, refetch } = useUnits();
  const [editModal, setEditModal] = useState(false);
  const [chargesModal, setChargesModal] = useState(false);
  const [selected, setSelected] = useState<PropertyWithBalance | null>(null);

  const openCreate = () => {
    setSelected(null);
    setEditModal(true);
  };

  const openEdit = (unit: PropertyWithBalance) => {
    setSelected(unit);
    setEditModal(true);
  };

  const openCharges = (unit: PropertyWithBalance) => {
    setSelected(unit);
    setChargesModal(true);
  };

  const handleSaved = () => {
    setEditModal(false);
    setSelected(null);
    void refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-ios-label">Departamentos</h1>
          <p className="text-sm text-ios-secondary">
            Unidades de la asociación y su copropietario asignado
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo departamento
        </Button>
      </div>

      <UnitsTable
        units={units}
        loading={loading}
        onEdit={openEdit}
        onViewCharges={openCharges}
      />

      <UnitFormModal
        open={editModal}
        unit={selected}
        owners={owners}
        authorizedCandidates={authorizedCandidates}
        onClose={() => setEditModal(false)}
        onSaved={handleSaved}
      />

      <PropertyChargesModal
        property={chargesModal ? selected : null}
        open={chargesModal}
        onClose={() => setChargesModal(false)}
      />
    </div>
  );
}
