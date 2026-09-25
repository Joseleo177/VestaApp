import { useCallback, useEffect, useState } from "react";
import { usePolling } from "@/lib/usePolling";
import { PropertyWithBalance } from "../types";
import { adminService } from "../services/admin.service";

const POLL_MS = 60_000;

interface Result {
  properties: PropertyWithBalance[];
  loading: boolean;
  /** Recarga inmediata: los saldos cambian al confirmar o rechazar un pago. */
  refetch: () => Promise<void>;
}

/** Listado global de propiedades con saldo (control de morosidad). */
export function useProperties(): Result {
  const [properties, setProperties] = useState<PropertyWithBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await adminService.listProperties();
      setProperties(data);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  usePolling(() => void fetch(true), POLL_MS);

  return { properties, loading, refetch: () => fetch(true) };
}
