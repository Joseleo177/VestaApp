import { useCallback, useEffect, useState } from "react";
import { Charge, ChargeStatus } from "@/types/domain";
import { billingService, PeriodSummary } from "../services/billing.service";

export interface PeriodProgress {
  /** Monto emitido sin lo exonerado (lo exonerado no se cobra). */
  billable: number;
  collected: number;
  paid: number;
  open: number;
  exonerated: number;
  overdue: number;
}

export interface PeriodRow extends PeriodSummary {
  progress: PeriodProgress | null;
}

interface Result {
  periods: PeriodRow[];
  loading: boolean;
  refetch: () => Promise<void>;
}

/** Lo que una cuota ya recibió, sin pasarse de su monto. */
const collectedOf = (c: Charge) =>
  c.status === ChargeStatus.PAID ? Number(c.amount) : Math.min(Number(c.amount), Number(c.amountPaid ?? 0));

export function progressOf(charges: Charge[]): PeriodProgress {
  const billable = charges.filter((c) => c.status !== ChargeStatus.EXONERATED);
  const open = billable.filter((c) => c.status === ChargeStatus.PENDING || c.status === ChargeStatus.PARTIAL);
  return {
    billable: billable.reduce((s, c) => s + Number(c.amount), 0),
    collected: billable.reduce((s, c) => s + collectedOf(c), 0),
    paid: billable.filter((c) => c.status === ChargeStatus.PAID).length,
    open: open.length,
    exonerated: charges.length - billable.length,
    overdue: open.filter((c) => c.overdue).length,
  };
}

/**
 * Períodos emitidos, cada uno con su avance de cobranza. El resumen de la API no
 * trae lo cobrado, así que se piden las cuotas de cada período en paralelo: son
 * pocos (uno por mes) y la cobranza es lo que el administrador viene a mirar.
 */
export function usePeriods(): Result {
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const list = await billingService.listPeriods();
      const charges = await Promise.all(
        list.map((p) => billingService.listForPeriod(p.period, p.type).catch(() => null))
      );
      setPeriods(list.map((p, i) => ({ ...p, progress: charges[i] ? progressOf(charges[i]!) : null })));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { periods, loading, refetch: () => fetch(true) };
}
