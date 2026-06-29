import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tower } from "@/types/domain";
import { ApiError } from "@/services/api";
import { towerService } from "../services/tower.service";

const towerSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
});

type TowerFormValues = z.infer<typeof towerSchema>;

interface TowerFormModalProps {
  open: boolean;
  tower?: Tower | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TowerFormModal({ open, tower, onClose, onSaved }: TowerFormModalProps) {
  const isEditing = !!tower;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TowerFormValues>({
    resolver: zodResolver(towerSchema),
    values: {
      name: tower?.name ?? "",
      description: tower?.description ?? "",
    },
  });

  const onSubmit = async (values: TowerFormValues) => {
    try {
      if (isEditing && tower) {
        await towerService.update(tower.id, values);
        toast.success("Torre actualizada");
      } else {
        await towerService.create(values);
        toast.success("Torre creada");
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
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="name"
          label="Nombre"
          placeholder="Ej. Torre A"
          error={errors.name?.message}
          {...register("name")}
        />
        <Input
          id="description"
          label="Descripción (opcional)"
          placeholder="Ej. Edificio principal norte"
          error={errors.description?.message}
          {...register("description")}
        />
        <div className="flex justify-end gap-3 pt-2">
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
