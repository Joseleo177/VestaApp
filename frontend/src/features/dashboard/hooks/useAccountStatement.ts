import { useCallback, useEffect, useRef, useState } from "react";
import { AccountStatement, Property } from "@/types/domain";
import { accountService } from "../services/account.service";

const POLL_MS = 20_000;

interface Result {
  statement: AccountStatement | null;
  properties: Property[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useAccountStatement(): Result {
  const [statement, setStatement] = useState<AccountStatement | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading]       = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [stmt, props] = await Promise.all([
        accountService.getStatement(),
        accountService.listMyProperties(),
      ]);
      setStatement(stmt);
      setProperties(props);
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

  return { statement, properties, loading, refetch: () => fetch(false) };
}
