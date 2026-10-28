import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { normalize } from "@/lib/search";
import { usePagination } from "@/lib/usePagination";
import { ApiError } from "@/services/api";
import { paymentService } from "@/features/payments/services/payment.service";
import { useSettledGuard } from "@/features/payments/hooks/useSettledGuard";
import {
  BankEntry,
  ReconciliationResult,
  ReviewMatch,
  StatementAccount,
  reconciliationService,
} from "../services/reconciliation.service";

export type EntryFilter = "all" | "free" | "matched";

const amountText = (n: number) => Number(n).toLocaleString("es-VE", { minimumFractionDigits: 2 });

/**
 * Estado de la página del extracto: movimientos guardados, filtros, selección,
 * subida de archivos y el resultado de la última conciliación.
 */
export function useBankStatement() {
  const [entries, setEntries] = useState<BankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { guard, dialog: settledDialog } = useSettledGuard();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setEntries(await reconciliationService.listEntries());
    } catch {
      toast.error("No se pudieron cargar los movimientos");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Cuenta ──
  // La página muestra una cuenta a la vez, y el extracto que se suba va a esa.
  const [account, setAccountState] = useState<StatementAccount>("BS");
  const accountCounts = useMemo(
    () => ({
      BS: entries.filter((e) => e.currency !== "USD").length,
      USD: entries.filter((e) => e.currency === "USD").length,
    }),
    [entries]
  );
  const accountEntries = useMemo(
    () => entries.filter((e) => (e.currency ?? "BS") === account),
    [entries, account]
  );

  // ── Resumen ──
  const summary = useMemo(() => {
    const matched = accountEntries.filter((e) => e.matched);
    const free = accountEntries.length - matched.length;
    const freeAmount = accountEntries.filter((e) => !e.matched).reduce((s, e) => s + Number(e.monto), 0);
    const lastUpload = accountEntries.reduce<string | null>(
      (last, e) => (!last || e.uploadedAt > last ? e.uploadedAt : last),
      null
    );
    return { total: accountEntries.length, matched: matched.length, free, freeAmount, lastUpload };
  }, [accountEntries]);

  // ── Filtros ──
  const [status, setStatus] = useState<EntryFilter>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const hasFilters = status !== "all" || search !== "" || dateFrom !== "" || dateTo !== "";
  const clearFilters = () => {
    setStatus("all");
    setSearch("");
    setDateFrom("");
    setDateTo("");
  };

  const filtered = useMemo(() => {
    const needle = normalize(search.trim());
    return accountEntries.filter((e) => {
      if (status === "matched" && !e.matched) return false;
      if (status === "free" && e.matched) return false;
      // Las fechas son "YYYY-MM-DD": comparar como texto ya ordena bien.
      if (dateFrom && (!e.fecha || e.fecha < dateFrom)) return false;
      if (dateTo && (!e.fecha || e.fecha > dateTo)) return false;
      if (!needle) return true;
      return normalize(`${e.referencia} ${e.descripcion ?? ""} ${amountText(e.monto)} ${e.monto}`).includes(needle);
    });
  }, [accountEntries, status, search, dateFrom, dateTo]);

  const paged = usePagination(filtered, 50);

  // ── Selección ──
  // "Todas" opera sobre lo filtrado, no solo sobre la página visible.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedEntries = useMemo(() => entries.filter((e) => selected.has(e.id)), [entries, selected]);
  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((e) => e.id)));
  const clearSelection = () => setSelected(new Set());

  // Al cambiar de cuenta la selección se suelta: no debe borrarse algo que ya no se ve.
  const setAccount = (a: StatementAccount) => {
    setAccountState(a);
    setSelected(new Set());
  };

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    setDeleting(true);
    try {
      await reconciliationService.deleteEntries([...selected]);
      toast.success(`${selected.size} ${selected.size === 1 ? "movimiento eliminado" : "movimientos eliminados"}`);
      setSelected(new Set());
      setConfirmDelete(false);
      void load(true);
    } catch {
      toast.error("No se pudieron eliminar los movimientos");
    } finally {
      setDeleting(false);
    }
  };

  // ── Conciliar lo pendiente contra lo ya guardado ──
  const [reconciling, setReconciling] = useState(false);
  const reconcilePending = async () => {
    setReconciling(true);
    try {
      const { confirmed, review } = await reconciliationService.reconcilePending();
      if (confirmed > 0) toast.success(`${confirmed} ${confirmed === 1 ? "pago confirmado" : "pagos confirmados"} automáticamente`);
      if (review > 0) toast.info(`${review} con monto distinto: revísalos en Pagos`);
      if (confirmed === 0 && review === 0) toast.info("No hay coincidencias nuevas");
      void load(true);
    } catch {
      toast.error("No se pudo conciliar");
    } finally {
      setReconciling(false);
    }
  };

  // ── Subir un extracto ──
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  const upload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("El extracto debe ser un archivo .xlsx");
      return;
    }
    setUploading(true);
    try {
      const res = await reconciliationService.reconcile(file, account);
      setResult(res);
      setResultOpen(true);
      void load(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo procesar el extracto");
    } finally {
      setUploading(false);
    }
  };

  // ── Revisar coincidencias dudosas ──
  const [busyId, setBusyId] = useState<string | null>(null);
  const settle = (m: ReviewMatch) =>
    setResult((r) => r && { ...r, review: r.review.filter((x) => x.paymentId !== m.paymentId), confirmed: [...r.confirmed, m] });

  const confirmFull = async (m: ReviewMatch) => {
    setBusyId(m.paymentId);
    try {
      await guard(
        (allowSettled) => paymentService.confirm(m.paymentId, allowSettled),
        () => {
          toast.success(`Pago de ${m.ownerName} confirmado`);
          settle(m);
          void load(true);
        }
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo confirmar");
    } finally {
      setBusyId(null);
    }
  };

  const confirmPartial = async (m: ReviewMatch) => {
    setBusyId(m.paymentId);
    try {
      await guard(
        (allowSettled) => paymentService.confirmPartial(m.paymentId, m.bankAmount, allowSettled),
        () => {
          toast.success(`Confirmado por lo que llegó al banco: ${amountText(m.bankAmount)}`);
          settle(m);
          void load(true);
        }
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo confirmar");
    } finally {
      setBusyId(null);
    }
  };

  return {
    loading,
    entries,
    account, setAccount, accountCounts,
    summary,
    // filtros
    status, setStatus, search, setSearch, dateFrom, setDateFrom, dateTo, setDateTo, hasFilters, clearFilters,
    filtered, paged,
    // selección
    selected, selectedEntries, allSelected, toggle, toggleAll, clearSelection,
    confirmDelete, setConfirmDelete, deleting, remove,
    // conciliación
    reconciling, reconcilePending,
    uploading, upload, result, resultOpen, setResultOpen,
    busyId, confirmFull, confirmPartial,
    settledDialog,
  };
}
