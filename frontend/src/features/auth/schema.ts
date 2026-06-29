import { z } from "zod";

export const loginSchema = z.object({
  cedula: z.string().min(1, "La cédula es requerida"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
