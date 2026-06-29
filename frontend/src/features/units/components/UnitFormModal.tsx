import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { User } from "@/types/domain";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { ApiError } from "@/services/api";
import { useTowers } from "@/features/towers/hooks/useTowers";
import { unitService } from "../services/unit.service";
import { unitSchema, UnitFormValues } from "../schema";

interface UnitFormModalProps {
  open: boolean;
  unit?: PropertyWithBalance | null;
  owners: User[];
  onClose: () => void;
  onSaved: () => void;
}

export function UnitFormModal({ open, unit, owners, onClose, onSaved }: UnitFormModalProps) {
  const isEditing = !!unit;
  const { towers } = useTowers();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    values: {
      code: unit?.code ?? "",
      towerId: unit?.tower?.id ?? "",
      ownerId: unit?.owner?.id ?? owners[0]?.id ?? "",
    },
  });

  const onSubmit = async (values: UnitFormValues) => {
    try {
      const payload = { ...values, towerId: values.towerId || undefined };
      if (isEditing && unit) {
        await unitService.update(unit.id, payload);
        toast.success("Departamento actualizado");
      } else {
        await unitService.create(payload);
        toast.success("Departamento creado");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo guardar");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar departamento" : "Nuevo departamento"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="code"
            label="Código / identificador"
            placeholder="Ej. Apt 4B"
            error={errors.code?.message}
            {...register("code")}
          />
          <Select
            id="towerId"
            label="Torre / bloque (opcional)"
            error={errors.towerId?.message}
            {...register("towerId")}
          >
            <option value="">Sin torre</option>
            {towers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>

        <Select
          id="ownerId"
          label="Copropietario"
          error={errors.ownerId?.message}
          {...register("ownerId")}
        >
          <option value="" disabled>
            Selecciona…
          </option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.fullName}
            </option>
          ))}
        </Select>

        {owners.length === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            No hay copropietarios activos. Crea uno en el módulo de Usuarios.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={owners.length === 0}>
            {isEditing ? "Guardar cambios" : "Crear departamento"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
