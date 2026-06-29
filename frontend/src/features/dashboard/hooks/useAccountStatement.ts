import { useCallback, useEffect, useState } from "react";
import { AccountStatement, Property } from "@/types/domain";
import { accountService } from "../services/account.service";

interface Result {
  statement: AccountStatement | null;
  properties: Property[];
  loading: boolean;
  refetch: () => Promise<void>;
}

/** Carga en paralelo el estado de cuenta y las propiedades del copropietario. */
export function useAccountStatement(): Result {
  const [statement, setStatement] = useState<AccountStatement | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [stmt, props] = await Promise.all([
        accountService.getStatement(),
        accountService.listMyProperties(),
      ]);
      setStatement(stmt);
      setProperties(props);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { statement, properties, loading, refetch: fetch };
}
