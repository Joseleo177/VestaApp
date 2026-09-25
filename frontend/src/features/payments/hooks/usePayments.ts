import { useCallback, useEffect, useState } from "react";
import { usePolling } from "@/lib/usePolling";
import { Payment } from "@/types/domain";
import { paymentService } from "../services/payment.service";

const POLL_MS = 60_000;

interface UsePaymentsResult {
  payments: Payment[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePayments(): UsePaymentsResult {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      setPayments(await paymentService.listMine());
    } catch {
      if (!silent) setError("No se pudo cargar el historial de pagos");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  // Polling silencioso, pausado con la pestaña oculta
  usePolling(() => void fetch(true), POLL_MS);

  return { payments, loading, error, refetch: () => fetch(false) };
}
