import { z } from "zod";

export const loginSchema = z.object({
  // El campo sigue viajando como `cedula` a la API; en la UI se llama "Usuario".
  cedula: z.string().min(1, "El usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
