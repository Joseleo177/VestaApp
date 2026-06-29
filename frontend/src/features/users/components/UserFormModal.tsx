import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { User, UserRole } from "@/types/domain";
import { ApiError } from "@/services/api";
import { userService } from "../services/user.service";
import { buildUserSchema, UserFormValues } from "../schema";
import { ROLE_LABELS } from "../types";

interface UserFormModalProps {
  open: boolean;
  /** Si viene un usuario, el modal edita; si no, crea. */
  user?: User | null;
  onClose: () => void;
  onSaved: () => void;
}

export function UserFormModal({ open, user, onClose, onSaved }: UserFormModalProps) {
  const isEditing = !!user;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(buildUserSchema(isEditing)),
    values: {
      fullName: user?.fullName ?? "",
      cedula: user?.cedula ?? "",
      phone: user?.phone ?? "",
      role: user?.role ?? UserRole.OWNER,
      password: "",
    },
  });

  const onSubmit = async (values: UserFormValues) => {
    try {
      if (isEditing && user) {
        await userService.update(user.id, {
          fullName: values.fullName,
          cedula: values.cedula,
          phone: values.phone,
          role: values.role,
          password: values.password || undefined,
        });
        toast.success("Usuario actualizado");
      } else {
        await userService.create({
          fullName: values.fullName,
          cedula: values.cedula,
          phone: values.phone,
          role: values.role,
          password: values.password as string,
        });
        toast.success("Usuario creado");
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
      title={isEditing ? "Editar usuario" : "Nuevo usuario"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="fullName"
          label="Nombre completo"
          error={errors.fullName?.message}
          {...register("fullName")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="cedula"
            type="text"
            label="Número de cédula"
            placeholder="Ej. 12345678"
            error={errors.cedula?.message}
            {...register("cedula")}
          />
          <Input
            id="phone"
            label="Teléfono (opcional)"
            error={errors.phone?.message}
            {...register("phone")}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select id="role" label="Rol" error={errors.role?.message} {...register("role")}>
            {Object.values(UserRole).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <Input
            id="password"
            type="password"
            label={isEditing ? "Nueva contraseña (opcional)" : "Contraseña"}
            placeholder={isEditing ? "Dejar en blanco para no cambiar" : "••••••••"}
            error={errors.password?.message}
            {...register("password")}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
