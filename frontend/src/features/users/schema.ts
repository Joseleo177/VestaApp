import { z } from "zod";
import { UserRole } from "@/types/domain";

/**
 * Schema del formulario de usuario. La contraseña es obligatoria al crear y
 * opcional al editar (se construye según el modo en el componente).
 */
export function buildUserSchema(isEditing: boolean) {
  const password = isEditing
    ? z
        .string()
        .min(6, "Mínimo 6 caracteres")
        .optional()
        .or(z.literal(""))
    : z.string().min(6, "Mínimo 6 caracteres");

  return z.object({
    fullName: z.string().min(3, "Indica el nombre completo"),
    cedula: z.string().min(1, "La cédula es requerida"),
    phone: z.string().optional(),
    role: z.nativeEnum(UserRole),
    password,
  });
}

export type UserFormValues = z.infer<ReturnType<typeof buildUserSchema>>;
