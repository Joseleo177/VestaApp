import { api } from "@/services/api";
import { RateCurrency } from "@/types/domain";

export interface ExchangeRate {
  currency: RateCurrency;
  rate: number;
  source: string;
  updatedAt: string;
  fetchedAt: string;
}

/** Tasas vigentes de las monedas activas y cuál es la principal. */
export interface ActiveRates {
  primary: RateCurrency;
  rates: ExchangeRate[];
}

export interface RateConfig {
  primary: RateCurrency;
  enabled: RateCurrency[];
}

export interface ExchangeRateRecord {
  id: string;
  date: string;
  currency: RateCurrency;
  rate: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export const exchangeRateService = {
  async get(force = false): Promise<ActiveRates> {
    const { data } = await api.get<ActiveRates>("/exchange-rate", {
      params: force ? { force: "true" } : undefined,
    });
    return data;
  },

  async getConfig(): Promise<RateConfig> {
    const { data } = await api.get<RateConfig>("/exchange-rate/config");
    return data;
  },

  async saveConfig(config: RateConfig): Promise<RateConfig> {
    const { data } = await api.put<RateConfig>("/exchange-rate/config", config);
    return data;
  },

  async history(): Promise<ExchangeRateRecord[]> {
    const { data } = await api.get<ExchangeRateRecord[]>("/exchange-rate/history");
    return data;
  },

  /** Guarda una tasa manual para la fecha indicada (por defecto hoy). */
  async save(rate: number, currency: RateCurrency, date?: string): Promise<ExchangeRateRecord> {
    const { data } = await api.post<ExchangeRateRecord>("/exchange-rate", { rate, currency, date });
    return data;
  },

  /** Tasa de una moneda aplicable a una fecha concreta (nearest-previous lookup). */
  async getForDate(date: string, currency: RateCurrency): Promise<ExchangeRate> {
    const { data } = await api.get<ExchangeRate>(`/exchange-rate/for-date/${date}`, {
      params: { currency },
    });
    return data;
  },

  /** Fuerza obtener las tasas actuales del BCV y guardarlas. */
  async fetchFromBcv(): Promise<ActiveRates> {
    const { data } = await api.post<ActiveRates>("/exchange-rate/fetch");
    return data;
  },
};
