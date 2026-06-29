import { useCallback, useEffect, useState } from "react";
import { billingService, PeriodSummary } from "../services/billing.service";

interface Result {
  periods: PeriodSummary[];
  loading: boolean;
  refetch: () => Promise<void>;
}

/** Períodos de gasto común ya emitidos. */
export function usePeriods(): Result {
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      setPeriods(await billingService.listPeriods());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { periods, loading, refetch: fetch };
}
