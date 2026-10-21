import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Payment, PaymentStatus } from "@/types/domain";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { unitService } from "@/features/units/services/unit.service";
import { formatPeriod } from "@/lib/format";
import { normalize } from "@/lib/search";
import { usePagination } from "@/lib/usePagination";
import { ApiError } from "@/services/api";
import { paymentService } from "../services/payment.service";
import { coveredCharges } from "../coveredCharges";
import { useSettledGuard } from "./useSettledGuard";

/** Código con que el backend pide motivo para anular un pago cuyas cuotas tienen recibo. */
const RECEIPTS_ISSUED = "RECEIPTS_ISSUED";

export type StatusFilter = "ALL" | PaymentStatus;

/**
 * Estado de la página de pagos. Se carga todo una vez y se filtra aquí: así cada
 * pestaña dice cuántos tiene y cambiar de pestaña no vuelve a pedir nada.
 */
export function useAllPaymentsLogic() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [properties, setProperties] = useState<PropertyWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const { guard, dialog: settledDialog } = useSettledGuard();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [list, props] = await Promise.all([paymentService.listAll(), unitService.list()]);
      setPayments(list);
      setProperties(props);
    } catch {
      toast.error("No se pudieron cargar los pagos");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  const reload = useCallback(() => load(true), [load]);

  // El titular del departamento, no quien registró: muchos pagos los carga el administrador.
  const ownerName = useCallback(
    (p: Payment) =>
      properties.find((x) => x.id === p.property?.id)?.owner?.fullName ?? p.submittedBy?.fullName ?? "—",
    [properties]
  );

  // ── Filtros ──
  const counts = useMemo(() => {
    const c = { ALL: payments.length, PENDING: 0, CONFIRMED: 0, REJECTED: 0 } as Record<StatusFilter, number>;
    payments.forEach((p) => c[p.status]++);
    return c;
  }, [payments]);

  // Sin elección, abre en lo que pide trabajo: los pagos por validar, si hay.
  const [chosen, setChosen] = useState<StatusFilter | null>(null);
  const status: StatusFilter = chosen ?? (counts.PENDING > 0 ? PaymentStatus.PENDING : "ALL");
  const [search, setSearch] = useState("");

  /** Varias palabras se exigen todas, en cualquier orden: "gori septiembre". */
  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    const list = status === "ALL" ? payments : payments.filter((p) => p.status === status);
    if (terms.length === 0) return list;
    return list.filter((p) => {
      const haystack = normalize(
        [
          ownerName(p),
          p.submittedBy?.fullName,
          p.submittedBy?.cedula,
          p.property?.code,
          p.reference,
          p.bank,
          ...coveredCharges(p).flatMap((c) => [c.period, formatPeriod(c.period), c.description, c.property?.code]),
        ]
          .filter(Boolean)
          .join(" ")
      );
      return terms.every((t) => haystack.includes(t));
    });
  }, [payments, status, search, ownerName]);

  const paged = usePagination(filtered, 25);

  // ── Ficha ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = payments.find((p) => p.id === selectedId) ?? null;

  // ── Acciones ──
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Payment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [voidTarget, setVoidTarget] = useState<{ payment: Payment; message: string } | null>(null);

  const confirm = async (p: Payment) => {
    setBusyId(p.id);
    try {
      await guard(
        (allowSettled) => paymentService.confirm(p.id, allowSettled),
        () => {
          toast.success(`Pago de ${ownerName(p)} confirmado`);
          void reload();
        }
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo confirmar");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (reason?: string) => {
    const target = rejectTarget;
    if (!target || !reason) return;
    setBusyId(target.id);
    setRejectTarget(null);
    try {
      await paymentService.reject(target.id, reason);
      toast.success("Pago rechazado");
      void reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo rechazar");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    const target = deleteTarget;
    if (!target) return;
    setBusyId(target.id);
    setDeleteTarget(null);
    try {
      await paymentService.delete(target.id);
      toast.success("Pago eliminado");
      setSelectedId(null);
      void reload();
    } catch (err) {
      // Tocó cuotas con recibo: no se borra, se anula con motivo.
      if (err instanceof ApiError && err.code === RECEIPTS_ISSUED) {
        setVoidTarget({ payment: target, message: err.message });
      } else {
        toast.error(err instanceof ApiError ? err.message : "No se pudo eliminar");
      }
    } finally {
      setBusyId(null);
    }
  };

  const voidPayment = async (reason?: string) => {
    if (!voidTarget || !reason) return;
    const target = voidTarget.payment;
    setBusyId(target.id);
    try {
      const message = await paymentService.delete(target.id, reason);
      toast.success(message ?? "Pago anulado");
      setVoidTarget(null);
      setSelectedId(null);
      void reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo anular");
    } finally {
      setBusyId(null);
    }
  };

  return {
    loading,
    reload,
    ownerName,
    // filtros
    counts, status, setStatus: setChosen, search, setSearch,
    // listado
    filtered, paged,
    // ficha
    selected, open: (p: Payment) => setSelectedId(p.id), close: () => setSelectedId(null),
    // acciones
    busyId, confirm,
    rejectTarget, setRejectTarget, reject,
    deleteTarget, setDeleteTarget, remove,
    voidTarget, setVoidTarget, voidPayment,
    settledDialog,
  };
}
