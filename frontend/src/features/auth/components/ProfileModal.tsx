import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { User, UserRole } from "@/types/domain";
import { ApiError } from "@/services/api";
import { formatDocumentId } from "@/lib/format";
import { ROLE_LABELS } from "@/features/users/types";
import { authService } from "../services/auth.service";

const profileSchema = z.object({
  fullName: z.string().trim().min(3, "Indica el nombre completo"),
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

/**
 * Datos propios. El administrador puede corregir su nombre; el vecino no: su
 * nombre identifica al titular en recibos y estados de cuenta, así que lo
 * cambia la administración (el backend lo exige igual).
 */
export function ProfileModal({ open, user, onClose, onSaved }: ProfileModalProps) {
  const isAdmin = user.role === UserRole.ADMIN;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      fullName: user.fullName ?? "",
      phone: user.phone ?? "",
      email: user.email ?? "",
      password: "",
    },
  });

  const name = watch("fullName");

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const updated = await authService.updateProfile({
        fullName: isAdmin && values.fullName.trim() !== user.fullName ? values.fullName.trim() : undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
        password: values.password || undefined,
      });
      toast.success("Perfil actualizado");
      // Lo que la respuesta no trae (p. ej. isActive) se conserva del usuario en sesión.
      onSaved({ ...user, ...updated });
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo actualizar el perfil");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mi perfil"
      description={`${ROLE_LABELS[user.role]} · ${formatDocumentId(user.cedulaTipo, user.cedula)}`}
      icon={<Avatar name={(isAdmin ? name : user.fullName) || user.fullName} className="!h-10 !w-10" />}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {isAdmin ? (
          <Input id="fullName" label="Nombre" autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
        ) : (
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-ios-secondary">Nombre</p>
            <div className="flex h-11 items-center justify-between gap-3 rounded-xl bg-ios-fill/50 px-3.5 text-[15px] text-ios-label">
              <span className="truncate">{user.fullName}</span>
              <Lock className="h-4 w-4 shrink-0 text-ios-tertiary" />
            </div>
            <p className="text-[12px] text-ios-secondary">Si tu nombre está mal escrito, pídele a la administración que lo corrija.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="phone"
            label="Teléfono"
            inputMode="tel"
            placeholder="Ej. 0414-1234567"
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
        </div>

        <Input
          id="password"
          type="password"
          label="Nueva contraseña"
          placeholder="Déjala en blanco para no cambiarla"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3">
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
