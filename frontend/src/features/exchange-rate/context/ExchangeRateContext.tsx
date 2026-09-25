import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { RateCurrency } from "@/types/domain";
import {
  ActiveRates,
  ExchangeRate,
  exchangeRateService,
} from "../services/exchange-rate.service";

interface ExchangeRateContextValue {
  data: ActiveRates | null;
  /** Tasa vigente de una moneda; si está desactivada, null. */
  rateOf: (currency: RateCurrency) => ExchangeRate | null;
  /** Tasa vigente de la moneda principal. */
  primary: ExchangeRate | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const ExchangeRateContext = createContext<ExchangeRateContextValue | null>(null);

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 min

/** Provee las tasas BCV a toda la app (top bar + conversiones a Bs). */
export function ExchangeRateProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ActiveRates | null>(null);
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

  const value = useMemo<ExchangeRateContextValue>(() => {
    const rateOf = (currency: RateCurrency) =>
      data?.rates.find((r) => r.currency === currency) ?? null;
    return {
      data,
      rateOf,
      primary: data ? rateOf(data.primary) : null,
      loading,
      refresh: () => load(true),
    };
  }, [data, loading, load]);

  return (
    <ExchangeRateContext.Provider value={value}>
      {children}
    </ExchangeRateContext.Provider>
  );
}
