import { z } from "zod";

export const unitSchema = z.object({
  code: z.string().min(1, "Indica el código del departamento"),
  towerId: z.string().optional(),
  ownerId: z.string().min(1, "Asigna un copropietario"),
});

export type UnitFormValues = z.infer<typeof unitSchema>;
