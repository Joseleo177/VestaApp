import { PaymentStatus } from "@/types/domain";
import { PAYMENT_STATUS_META } from "../types";
import { cn } from "@/lib/cn";

const tones: Record<string, string> = {
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  danger: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

/** Badge de color por estado de pago: Amarillo / Verde / Rojo. */
export function StatusBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[meta.tone]
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-amber-500": meta.tone === "warning",
          "bg-emerald-500": meta.tone === "success",
          "bg-rose-500": meta.tone === "danger",
        })}
      />
      {meta.label}
    </span>
  );
}
