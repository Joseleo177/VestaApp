import { useCallback, useEffect, useState } from "react";
import { Payment } from "@/types/domain";
import { paymentService } from "@/features/payments/services/payment.service";

interface Result {
  pending: Payment[];
  loading: boolean;
  refetch: () => Promise<void>;
}

/** Cola de pagos pendientes de validación (admin). */
export function usePendingPayments(): Result {
  const [pending, setPending] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      setPending(await paymentService.listPending());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { pending, loading, refetch: fetch };
}
