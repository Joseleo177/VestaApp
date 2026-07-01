import { useCallback, useEffect, useRef, useState } from "react";
import { PropertyWithBalance } from "../types";
import { adminService } from "../services/admin.service";

const POLL_MS = 20_000;

interface Result {
  properties: PropertyWithBalance[];
  loading: boolean;
}

/** Listado global de propiedades con saldo (control de morosidad). */
export function useProperties(): Result {
  const [properties, setProperties] = useState<PropertyWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    timer.current = setInterval(() => void fetch(true), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetch(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetch]);

  return { properties, loading };
}
