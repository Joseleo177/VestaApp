import { PaymentCurrency, PaymentStatus } from "@/types/domain";

export const PAYMENT_CURRENCY_LABELS: Record<PaymentCurrency, string> = {
  [PaymentCurrency.DIVISAS]: "Divisas (€)",
  [PaymentCurrency.BS]: "Bolívares (Bs)",
};

/** Metadatos de presentación por estado (color + etiqueta en español). */
export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; tone: "warning" | "success" | "danger" }
> = {
  [PaymentStatus.PENDING]: { label: "Pendiente", tone: "warning" },
  [PaymentStatus.CONFIRMED]: { label: "Confirmado", tone: "success" },
  [PaymentStatus.REJECTED]: { label: "Rechazado", tone: "danger" },
};
