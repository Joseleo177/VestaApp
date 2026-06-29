import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ExchangeRate, exchangeRateService } from "../services/exchange-rate.service";

interface ExchangeRateContextValue {
  data: ExchangeRate | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const ExchangeRateContext = createContext<ExchangeRateContextValue | null>(null);

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 min

/** Provee la tasa BCV a toda la app (top bar + conversiones a Bs). */
export function ExchangeRateProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setData(await exchangeRateService.get(force));
    } catch {
      // Silencioso: el top bar mostrará "—" si no hay tasa.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  const value = useMemo<ExchangeRateContextValue>(
    () => ({ data, loading, refresh: () => load(true) }),
    [data, loading, load]
  );

  return (
    <ExchangeRateContext.Provider value={value}>
      {children}
    </ExchangeRateContext.Provider>
  );
}
