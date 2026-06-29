import { z } from "zod";
import { PaymentCurrency } from "@/types/domain";

export const MODALIDADES_BS      = ["Efectivo", "Pago Móvil", "Transferencia"] as const;
export const MODALIDADES_DIVISAS = ["Efectivo", "Zelle"] as const;

export const paymentSchema = z
  .object({
    chargeId: z.string().min(1, "Selecciona la cuota a pagar"),
    currency: z.nativeEnum(PaymentCurrency, {
      errorMap: () => ({ message: "Selecciona la moneda de pago" }),
    }),
    modalidad: z.string().min(1, "Selecciona la modalidad de pago"),
    amountBs: z.coerce
      .number({ invalid_type_error: "Ingresa el monto transferido" })
      .positive("El monto debe ser mayor a 0")
      .optional(),
    reference: z.string().max(40, "Referencia demasiado larga").optional(),
    paymentDate: z
      .string()
      .min(1, "Indica la fecha del pago")
      .refine(
        (v) => new Date(v).getTime() <= Date.now(),
        "La fecha no puede ser futura"
      ),
  })
  .superRefine((data, ctx) => {
    if (data.currency === PaymentCurrency.BS && !data.amountBs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ingresa el monto en Bs que transferiste",
        path: ["amountBs"],
      });
    }
    if (data.modalidad !== "Efectivo") {
      if (!data.reference || data.reference.trim().length < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La referencia debe tener al menos 4 caracteres",
          path: ["reference"],
        });
      }
    }
  });

export type PaymentFormValues = z.infer<typeof paymentSchema>;
