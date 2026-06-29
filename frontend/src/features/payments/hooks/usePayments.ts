import { useCallback, useEffect, useRef, useState } from "react";
import { Payment } from "@/types/domain";
import { paymentService } from "../services/payment.service";

const POLL_MS = 20_000;

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
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // Polling silencioso
    timer.current = setInterval(() => void fetch(true), POLL_MS);

    // Refetch inmediato al volver a la pestaña
    const onVisible = () => { if (document.visibilityState === "visible") void fetch(true); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetch]);

  return { payments, loading, error, refetch: () => fetch(false) };
}
