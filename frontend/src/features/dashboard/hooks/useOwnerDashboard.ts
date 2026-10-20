import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Charge, ChargeStatus, PaymentStatus, RateCurrency } from "@/types/domain";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useExchangeRate } from "@/features/exchange-rate/hooks/useExchangeRate";
import { usePayments } from "@/features/payments/hooks/usePayments";
import { ReportService } from "@/services/report.service";
import { useAccountStatement } from "./useAccountStatement";
import { daysPastDue, dueAmount, isOpenCharge } from "../dueDays";

const byDueAsc = (a: Charge, b: Charge) =>
  a.dueDate.localeCompare(b.dueDate) || a.period.localeCompare(b.period);

/**
 * Todo el estado del panel del propietario: qué debe, qué pagó, qué tiene en
 * revisión, qué cuotas marcó para pagar juntas y el formulario de pago. La
 * página y sus componentes solo pintan.
 */
export function useOwnerDashboard() {
  const { user } = useAuth();
  const { rateOf } = useExchangeRate();
  const {
    statement,
    properties,
    loading: loadingStatement,
    refetch: refetchStatement,
  } = useAccountStatement();
  const { payments, loading: loadingPayments, refetch: refetchPayments } = usePayments();

  const charges = useMemo(() => statement?.charges ?? [], [statement]);

  // ── Cuotas ──
  // Abiertas de la más vieja a la más nueva: es el orden en que se saldan.
  const open = useMemo(() => charges.filter(isOpenCharge).sort(byDueAsc), [charges]);
  // Con un pago ya en revisión no se vuelve a pagar: se espera a la administración.
  const payable = useMemo(() => open.filter((c) => !c.pendingPayment), [open]);
  const closed = useMemo(
    () =>
      charges
        .filter((c) => c.status === ChargeStatus.PAID || c.status === ChargeStatus.EXONERATED)
        .sort((a, b) => byDueAsc(b, a)),
    [charges]
  );
  const overdue = useMemo(() => open.filter((c) => daysPastDue(c.dueDate) > 0), [open]);
  const nextDue = open[0];

  // Quien gestiona varias unidades (titular de una, autorizado de otra)
  // necesita ver a qué departamento es cada cuota.
  const multiUnit = useMemo(
    () => properties.length > 1 || new Set(charges.map((c) => c.property?.id ?? "")).size > 1,
    [properties, charges]
  );

  // ── Saldo ──
  const balance = Number(statement?.balance ?? 0);
  const creditBalance = Number(statement?.creditBalance ?? 0);

  // Cada parte de la deuda se convierte con la tasa de su moneda. Si falta una
  // tasa (moneda desactivada) no se muestra un equivalente incompleto.
  const balanceBs = useMemo(() => {
    const parts = statement?.balanceByCurrency;
    if (!parts || balance <= 0) return null;
    let total = 0;
    for (const c of [RateCurrency.USD, RateCurrency.EUR]) {
      if (!parts[c]) continue;
      const r = rateOf(c);
      if (!r) return null;
      total += parts[c] * r.rate;
    }
    return total;
  }, [statement, balance, rateOf]);

  // ── Pagos ──
  // El historial llega del más reciente al más viejo.
  const lastConfirmed = useMemo(
    () => payments.find((p) => p.status === PaymentStatus.CONFIRMED),
    [payments]
  );
  const inReview = useMemo(() => payments.filter((p) => p.status === PaymentStatus.PENDING), [payments]);
  // Un rechazo solo se avisa si es lo último que pasó: si después pagó de
  // nuevo, ya lo resolvió y el aviso sería ruido.
  const lastRejected = payments[0]?.status === PaymentStatus.REJECTED ? payments[0] : null;

  // ── Selección para pagar varias juntas ──
  const [checked, setChecked] = useState<string[]>([]);
  // Tras recargar, una cuota marcada pudo pagarse o quedar en revisión.
  const selected = useMemo(() => payable.filter((c) => checked.includes(c.id)), [payable, checked]);
  const selectedTotal = selected.reduce((s, c) => s + dueAmount(c), 0);
  const allSelected = payable.length > 0 && selected.length === payable.length;

  const toggle = (id: string) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () => setChecked(allSelected ? [] : payable.map((c) => c.id));

  // ── Formulario de pago ──
  const [payIds, setPayIds] = useState<string[] | null>(null);
  const payOne = (c: Charge) => setPayIds([c.id]);
  const paySelected = () => setPayIds(selected.map((c) => c.id));
  const payAll = () => setPayIds(payable.map((c) => c.id));
  const closePay = () => setPayIds(null);
  const onPaid = () => {
    setPayIds(null);
    setChecked([]);
    void refetchPayments();
    void refetchStatement();
  };

  // ── Estado de cuenta en PDF ──
  const [downloading, setDownloading] = useState(false);
  const downloadStatement = useCallback(async () => {
    setDownloading(true);
    try {
      await ReportService.downloadAccountStatement();
    } catch {
      toast.error("No se pudo descargar el estado de cuenta");
    } finally {
      setDownloading(false);
    }
  }, []);

  return {
    user,
    loadingStatement,
    loadingPayments,
    properties,
    // cuotas
    open, payable, closed, overdue, nextDue, multiUnit,
    // saldo
    balance, balanceBs, creditBalance,
    // pagos
    payments, lastConfirmed, inReview, lastRejected,
    // selección
    selected, selectedTotal, allSelected, toggle, toggleAll,
    // pago
    payIds, payOne, paySelected, payAll, closePay, onPaid,
    // PDF
    downloading, downloadStatement,
  };
}
