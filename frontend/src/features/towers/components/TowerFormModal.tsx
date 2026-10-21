import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Modal, ModalIcon } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tower } from "@/types/domain";
import { ApiError } from "@/services/api";
import { cn } from "@/lib/cn";
import { towerService } from "../services/tower.service";

const DESCRIPTION_MAX = 120;

const towerSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre a la torre").max(60, "Máximo 60 caracteres"),
  description: z.string().max(DESCRIPTION_MAX, `Máximo ${DESCRIPTION_MAX} caracteres`).optional(),
});

type TowerFormValues = z.infer<typeof towerSchema>;

interface TowerFormModalProps {
  open: boolean;
  tower?: Tower | null;
  /** Departamentos que tiene (al editar): se dice en la cabecera. */
  units?: number;
  onClose: () => void;
  onSaved: () => void;
}

export function TowerFormModal({ open, tower, units = 0, onClose, onSaved }: TowerFormModalProps) {
  const isEditing = !!tower;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TowerFormValues>({
    resolver: zodResolver(towerSchema),
    values: {
      name: tower?.name ?? "",
      description: tower?.description ?? "",
    },
  });

  const description = watch("description") ?? "";

  const onSubmit = async (values: TowerFormValues) => {
    // Cadena vacía y no `undefined`: así borrar la descripción al editar la borra de verdad.
    const input = { name: values.name.trim(), description: values.description?.trim() ?? "" };
    try {
      if (isEditing && tower) {
        await towerService.update(tower.id, input);
        toast.success(`"${input.name}" actualizada`);
      } else {
        await towerService.create(input);
        toast.success(`"${input.name}" creada`);
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
      title={isEditing ? "Editar torre" : "Nueva torre"}
      description={
        isEditing
          ? `${units} ${units === 1 ? "departamento asignado" : "departamentos asignados"}`
          : "Agrúpala para emitir cuotas y ver su morosidad por separado."
      }
      icon={
        <ModalIcon tone="bg-teal-500/[0.12] text-teal-600 dark:text-teal-400">
          <Building2 className="h-5 w-5" />
        </ModalIcon>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="name"
          label="Nombre"
          placeholder="Ej. Torre A"
          autoFocus
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="description" className="block text-[13px] font-medium text-ios-secondary">
              Descripción <span className="font-normal">(opcional)</span>
            </label>
            <span
              className={cn(
                "text-[12px] tabular-nums",
                description.length > DESCRIPTION_MAX ? "text-red-600" : "text-ios-tertiary"
              )}
            >
              {description.length}/{DESCRIPTION_MAX}
            </span>
          </div>
          <textarea
            id="description"
            rows={3}
            placeholder="Ej. Edificio principal, entrada por la avenida"
            className={cn(
              "w-full resize-none rounded-xl border-0 bg-ios-fill px-3.5 py-3 text-[15px] text-ios-label placeholder:text-ios-secondary focus:outline-none focus:ring-2",
              errors.description ? "ring-1 ring-ios-red/50 focus:ring-ios-red" : "focus:ring-brand-500/70"
            )}
            {...register("description")}
          />
          {errors.description && <p className="text-[13px] font-medium text-ios-red">{errors.description.message}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? "Guardar cambios" : "Crear torre"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
