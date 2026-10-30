import { useCallback, useEffect, useMemo, useState } from "react";
import { Charge, ChargeStatus, Payment, PaymentStatus } from "@/types/domain";
import { billingService } from "@/features/billing/services/billing.service";
import { paymentService } from "@/features/payments/services/payment.service";
import { usePolling } from "@/lib/usePolling";
import { usePendingPayments } from "./usePendingPayments";
import { useProperties } from "./useProperties";

const MONTHS_IN_CHART = 6;
const EPS = 0.005;

/** "2026-10" del día de hoy o de una fecha ISO, en hora local. */
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Lo que una cuota ya recibió, sin pasarse de su monto. */
const collectedOf = (c: Charge) => {
  const amount = Number(c.amount);
  if (c.status === ChargeStatus.PAID) return amount;
  return Math.min(amount, Number(c.amountPaid ?? 0));
};

export interface MonthIncome {
  key: string;
  label: string;
  total: number;
  count: number;
  current: boolean;
}

/**
 * Todo lo que el panel del administrador cuenta. Sale de lo que la API ya da:
 * propiedades con saldo, cola de validación, pagos confirmados y las cuotas del
 * último período emitido.
 */
export function useAdminDashboard() {
  const { pending, loading: loadingPending, refetch: refetchPending } = usePendingPayments();
  const { properties, loading: loadingProps, refetch: refetchProps } = useProperties();

  const [confirmed, setConfirmed] = useState<Payment[]>([]);
  const [period, setPeriod] = useState<string | null>(null);
  const [periodCharges, setPeriodCharges] = useState<Charge[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const fetchActivity = useCallback(async (silent = false) => {
    if (!silent) setLoadingActivity(true);
    try {
      const [payments, periods] = await Promise.all([
        paymentService.listAll(PaymentStatus.CONFIRMED),
        billingService.listPeriods(),
      ]);
      setConfirmed(payments);
      // Vienen del más reciente al más viejo; la cobranza que importa es la del último.
      const latest = periods[0]?.period ?? null;
      setPeriod(latest);
      setPeriodCharges(latest ? await billingService.listForPeriod(latest) : []);
    } catch {
      // El panel sigue útil con lo demás; las secciones muestran su vacío.
    } finally {
      if (!silent) setLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);
  usePolling(() => void fetchActivity(true), 60_000);

  // ── Cobranza del período ──
  const collection = useMemo(() => {
    // Lo exonerado no se cobra: no cuenta ni en lo emitido ni en lo cobrado.
    const billable = periodCharges.filter((c) => c.status !== ChargeStatus.EXONERATED);
    const emitted = billable.reduce((s, c) => s + Number(c.amount), 0);
    const collected = billable.reduce((s, c) => s + collectedOf(c), 0);

    // Un departamento "pagó" el período cuando no le queda ninguna cuota abierta.
    const byUnit = new Map<string, boolean>();
    for (const c of billable) {
      const id = c.property?.id ?? c.id;
      const settled = c.status === ChargeStatus.PAID;
      byUnit.set(id, (byUnit.get(id) ?? true) && settled);
    }
    const units = byUnit.size;
    const paidUnits = [...byUnit.values()].filter(Boolean).length;

    return {
      emitted,
      collected,
      remaining: Math.max(0, emitted - collected),
      ratio: emitted > EPS ? collected / emitted : 0,
      units,
      paidUnits,
    };
  }, [periodCharges]);

  // ── Ingresos por mes (fecha del pago) ──
  const income = useMemo<MonthIncome[]>(() => {
    const now = new Date();
    const months: MonthIncome[] = [];
    for (let i = MONTHS_IN_CHART - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("es-VE", { month: "short" }).replace(".", "");
      months.push({
        key: monthKey(d),
        label: label.charAt(0).toUpperCase() + label.slice(1),
        total: 0,
        count: 0,
        current: i === 0,
      });
    }
    const index = new Map(months.map((m) => [m.key, m]));
    for (const p of confirmed) {
      const m = index.get(p.paymentDate.slice(0, 7));
      // Lo pagado con saldo a favor ya entró como ingreso con el pago que lo dejó.
      if (!m || p.fromCredit) continue;
      m.total += Number(p.amount);
      m.count++;
    }
    return months;
  }, [confirmed]);

  const thisMonth = income[income.length - 1];
  const lastMonth = income[income.length - 2];

  // ── Morosidad ──
  const debtors = useMemo(
    () => properties.filter((p) => Number(p.balance) > EPS).sort((a, b) => Number(b.balance) - Number(a.balance)),
    [properties]
  );
  const totalDebt = debtors.reduce((s, p) => s + Number(p.balance), 0);
  const pendingTotal = pending.reduce((s, p) => s + Number(p.amount), 0);

  // Lo último que se confirmó, por fecha de revisión (o de pago en los viejos).
  const recent = useMemo(
    () =>
      [...confirmed]
        .sort((a, b) => (b.reviewedAt ?? b.paymentDate).localeCompare(a.reviewedAt ?? a.paymentDate))
        .slice(0, 5),
    [confirmed]
  );

  // La lista de pagos solo trae el código del departamento: el titular sale de
  // las propiedades. Quien registró no sirve: muchas veces es el administrador.
  const ownerName = useCallback(
    (p: Payment) => {
      const owner = properties.find((x) => x.id === p.property?.id)?.owner;
      return owner?.fullName ?? p.submittedBy?.fullName ?? "Vecino";
    },
    [properties]
  );

  // Confirmar o rechazar mueve la cola, los saldos y los ingresos.
  const refreshAll = useCallback(() => {
    void refetchPending();
    void refetchProps();
    void fetchActivity(true);
  }, [refetchPending, refetchProps, fetchActivity]);

  return {
    loading: loadingProps || loadingPending,
    loadingActivity,
    properties,
    pending,
    pendingTotal,
    period,
    collection,
    income,
    thisMonth,
    lastMonth,
    debtors,
    totalDebt,
    recent,
    ownerName,
    refreshAll,
  };
}
