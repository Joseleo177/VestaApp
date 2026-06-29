import { z } from "zod";
import { ChargeType } from "@/types/domain";

export const generateChargesSchema = z
  .object({
    period: z.string().regex(/^\d{4}-\d{2}$/, "Selecciona un período válido"),
    amount: z.coerce.number({ invalid_type_error: "Monto inválido" }).positive("La cuota debe ser mayor a cero"),
    moraAmount: z.coerce.number({ invalid_type_error: "Monto inválido" }).min(0),
    dueDate: z.string().min(1, "Indica la fecha de vencimiento"),
    type: z.nativeEnum(ChargeType),
    towerIds: z.array(z.string()),
    description: z.string().optional(),
  })
  .refine(
    (d) => d.type !== ChargeType.SPECIAL || (d.description && d.description.trim().length > 0),
    { message: "La cuota especial requiere una descripción", path: ["description"] }
  );

export type GenerateChargesValues = z.infer<typeof generateChargesSchema>;
