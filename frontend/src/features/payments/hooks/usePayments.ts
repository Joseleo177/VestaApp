import { useCallback, useEffect, useState } from "react";
import { Payment } from "@/types/domain";
import { paymentService } from "../services/payment.service";

interface UsePaymentsResult {
  payments: Payment[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook de datos para el historial de pagos del copropietario. El estado de la
 * lista vive aquí (local al feature), no en el contexto global.
 */
export function usePayments(): UsePaymentsResult {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayments(await paymentService.listMine());
    } catch {
      setError("No se pudo cargar el historial de pagos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { payments, loading, error, refetch: fetch };
}
