import { z } from "zod";
import { PaymentCurrency } from "@/types/domain";

// El primer valor es el predeterminado (el form lo aplica al cambiar de moneda).
export const MODALIDADES_BS      = ["Transferencia", "Efectivo"] as const;
export const MODALIDADES_DIVISAS = ["Transferencia", "Efectivo"] as const;

export const paymentSchema = z
  .object({
    chargeIds: z.array(z.string()).min(1, "Selecciona al menos una cuota"),
    currency: z.nativeEnum(PaymentCurrency, {
      errorMap: () => ({ message: "Selecciona la moneda de pago" }),
    }),
    modalidad: z.string().min(1, "Selecciona la modalidad de pago"),
    amountBs: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce
        .number({ invalid_type_error: "Ingresa el monto transferido" })
        .positive("El monto debe ser mayor a 0")
        .optional()
    ),
    /** Solo en un abono en divisas: lo que de verdad entregó. Vacío = el total. */
    amountEur: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce
        .number({ invalid_type_error: "Ingresa el monto entregado" })
        .positive("El monto debe ser mayor a 0")
        .optional()
    ),
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
      // Solo los últimos 6 dígitos: la conciliación los casa con el extracto.
      if (!/^\d{6}$/.test(data.reference?.trim() ?? "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Escribe los últimos 6 dígitos de la referencia",
          path: ["reference"],
        });
      }
    }
  });

export type PaymentFormValues = z.infer<typeof paymentSchema>;
