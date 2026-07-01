import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { User } from "@/types/domain";
import { ApiError } from "@/services/api";
import { authService } from "../services/auth.service";

const profileSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  password: z.string().min(6, "Mínimo 6 caracteres").optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileModalProps {
  open: boolean;
  user: User;
  onClose: () => void;
  onSaved: (user: User) => void;
}

export function ProfileModal({ open, user, onClose, onSaved }: ProfileModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      phone: user.phone ?? "",
      email: user.email ?? "",
      password: "",
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const updatedUser = await authService.updateProfile({
        phone: values.phone || undefined,
        email: values.email || undefined,
        password: values.password || undefined,
      });
      toast.success("Perfil actualizado");
      onSaved(updatedUser);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo actualizar el perfil");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Mi Perfil">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="phone"
          label="Teléfono"
          placeholder="Ej. +584141234567"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <Input
          id="email"
          type="email"
          label="Correo electrónico"
          placeholder="Ej. usuario@correo.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          id="password"
          type="password"
          label="Nueva contraseña"
          placeholder="Dejar en blanco para no cambiar"
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}
