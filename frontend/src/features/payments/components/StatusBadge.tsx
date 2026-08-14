import { PaymentStatus } from "@/types/domain";
import { PAYMENT_STATUS_META } from "../types";
import { cn } from "@/lib/cn";

const tones: Record<string, string> = {
  warning: "bg-ios-orange/10 text-ios-orange",
  success: "bg-ios-green/10 text-ios-green",
  danger: "bg-ios-red/10 text-ios-red",
};

/** Badge de color por estado de pago: Amarillo / Verde / Rojo. */
export function StatusBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[meta.tone]
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-ios-orange": meta.tone === "warning",
          "bg-ios-green": meta.tone === "success",
          "bg-ios-red": meta.tone === "danger",
        })}
      />
      {meta.label}
    </span>
  );
}
