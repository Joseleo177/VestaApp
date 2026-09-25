import { useCallback, useEffect, useState } from "react";
import { usePolling } from "@/lib/usePolling";
import { AccountStatement, Property } from "@/types/domain";
import { accountService } from "../services/account.service";

const POLL_MS = 60_000;

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
  }, [fetch]);

  // Polling silencioso, pausado con la pestaña oculta
  usePolling(() => void fetch(true), POLL_MS);

  return { statement, properties, loading, refetch: () => fetch(false) };
}
