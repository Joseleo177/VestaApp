import { z } from "zod";
import { ChargeType, RateCurrency } from "@/types/domain";

export const generateChargesSchema = z
  .object({
    period: z.string().regex(/^\d{4}-\d{2}$/, "Selecciona un período válido"),
    amount: z.coerce.number({ invalid_type_error: "Monto inválido" }).positive("La cuota debe ser mayor a cero"),
    // Vacío: la cuota cuesta lo mismo en divisas que en Bs.
    bsPrice: z.preprocess(
      (v) => (v === "" || v === null || (typeof v === "number" && Number.isNaN(v)) ? undefined : v),
      z.coerce.number({ invalid_type_error: "Monto inválido" }).positive("Debe ser mayor a cero").optional()
    ),
    moraAmount: z.coerce.number({ invalid_type_error: "Monto inválido" }).min(0),
    dueDate: z.string().min(1, "Indica la fecha de vencimiento"),
    type: z.nativeEnum(ChargeType),
    currency: z.nativeEnum(RateCurrency, {
      errorMap: () => ({ message: "Elige la tasa de cobro" }),
    }),
    towerIds: z.array(z.string()),
    propertyIds: z.array(z.string()).optional(),
    description: z.string().optional(),
  })
  .refine(
    (d) => d.type !== ChargeType.SPECIAL || (d.description && d.description.trim().length > 0),
    { message: "La cuota especial requiere una descripción", path: ["description"] }
  );

export type GenerateChargesValues = z.infer<typeof generateChargesSchema>;
