import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { SearchSelect, SearchOption } from "@/components/ui/SearchSelect";
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
  /** Usuarios que pueden figurar como autorizados (copropietarios + autorizados). */
  authorizedCandidates: User[];
  onClose: () => void;
  onSaved: () => void;
}

export function UnitFormModal({
  open,
  unit,
  owners,
  authorizedCandidates,
  onClose,
  onSaved,
}: UnitFormModalProps) {
  const isEditing = !!unit;
  const { towers } = useTowers();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    values: {
      code: unit?.code ?? "",
      towerId: unit?.tower?.id ?? "",
      ownerId: unit?.owner?.id ?? owners[0]?.id ?? "",
      authorizedId: unit?.authorized?.id ?? "",
    },
  });

  const ownerId = watch("ownerId");
  const authorizedId = watch("authorizedId");
  const sameAsOwner = !!ownerId && authorizedId === ownerId;

  // La cédula va como `hint`: se muestra bajo el nombre y también se busca por ella.
  const ownerOptions: SearchOption[] = owners.map((o) => ({
    value: o.id,
    label: o.fullName,
    hint: `C.I. ${o.cedula}`,
  }));

  const authorizedOptions: SearchOption[] = authorizedCandidates.map((u) => ({
    value: u.id,
    label: u.id === ownerId ? `${u.fullName} (titular)` : u.fullName,
    hint: `C.I. ${u.cedula}`,
  }));

  const onSubmit = async (values: UnitFormValues) => {
    try {
      // authorizedId siempre viaja: "" desasigna el autorizado en el backend.
      const payload = {
        ...values,
        towerId: values.towerId || undefined,
        authorizedId: values.authorizedId ?? "",
      };
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

        <SearchSelect
          id="ownerId"
          label="Copropietario"
          value={ownerId}
          onChange={(v) => setValue("ownerId", v, { shouldDirty: true, shouldValidate: true })}
          options={ownerOptions}
          error={errors.ownerId?.message}
        />

        <div className="space-y-2">
          <SearchSelect
            id="authorizedId"
            label="Autorizado (opcional)"
            value={authorizedId ?? ""}
            onChange={(v) => setValue("authorizedId", v, { shouldDirty: true })}
            options={authorizedOptions}
            emptyLabel="Sin autorizado"
            placeholder="Sin autorizado"
            error={errors.authorizedId?.message}
          />
          <label className="flex items-center gap-2 text-xs text-ios-secondary">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-ios-separator text-brand-600 focus:ring-brand-500"
              checked={sameAsOwner}
              disabled={!ownerId}
              onChange={(e) =>
                setValue("authorizedId", e.target.checked ? ownerId : "", {
                  shouldDirty: true,
                })
              }
            />
            El titular es también el autorizado
          </label>
        </div>

        {owners.length === 0 && (
          <p className="rounded-lg bg-ios-orange/10 px-3 py-2 text-xs text-ios-orange">
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
