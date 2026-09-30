import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ApiError } from "@/services/api";

/** Código con que el backend rechaza confirmar un pago cuyas cuotas ya están pagadas. */
const SETTLED_TARGETS = "CHARGES_ALREADY_SETTLED";

/**
 * Confirmar un pago cuyas cuotas ya están todas pagadas manda su monto a otras
 * cuotas o al saldo a favor, y casi siempre es un duplicado. El backend lo
 * rechaza con un aviso; este hook lo muestra y, si el admin acepta, repite la
 * confirmación sabiéndolo. Un segundo abono a una cuota parcial no pasa por aquí.
 */
export function useSettledGuard() {
  const [pending, setPending] = useState<{ message: string; retry: () => Promise<void> } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  /**
   * Ejecuta `confirm(false)` y luego `onDone`. Si las cuotas ya estaban pagadas
   * abre el diálogo en vez de fallar; cualquier otro error se relanza.
   */
  const guard = async (
    confirm: (allowSettled: boolean) => Promise<void>,
    onDone: () => void
  ): Promise<void> => {
    try {
      await confirm(false);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === SETTLED_TARGETS) {
        setPending({
          message: err.message,
          retry: async () => {
            await confirm(true);
            onDone();
          },
        });
        return;
      }
      throw err;
    }
  };

  const handleAccept = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await pending.retry();
      setPending(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo confirmar");
    } finally {
      setBusy(false);
    }
  };

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onClose={() => setPending(null)}
      onConfirm={handleAccept}
      title="Las cuotas ya están pagadas"
      description={pending?.message ?? ""}
      confirmLabel="Confirmar igual"
      loading={busy}
    />
  );

  return { guard, dialog };
}
