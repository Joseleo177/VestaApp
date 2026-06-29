import { api } from "@/services/api";

export interface ExchangeRate {
  rate: number;
  source: string;
  updatedAt: string;
  fetchedAt: string;
}

export interface ExchangeRateRecord {
  id: string;
  date: string;
  rate: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export const exchangeRateService = {
  async get(force = false): Promise<ExchangeRate> {
    const { data } = await api.get<ExchangeRate>("/exchange-rate", {
      params: force ? { force: "true" } : undefined,
    });
    return data;
  },

  async history(): Promise<ExchangeRateRecord[]> {
    const { data } = await api.get<ExchangeRateRecord[]>("/exchange-rate/history");
    return data;
  },

  /** Guarda una tasa manual para la fecha indicada (por defecto hoy). */
  async save(rate: number, date?: string): Promise<ExchangeRateRecord> {
    const { data } = await api.post<ExchangeRateRecord>("/exchange-rate", { rate, date });
    return data;
  },

  /** Devuelve la tasa aplicable a una fecha concreta (nearest-previous lookup). */
  async getForDate(date: string): Promise<ExchangeRate> {
    const { data } = await api.get<ExchangeRate>(`/exchange-rate/for-date/${date}`);
    return data;
  },

  /** Fuerza obtener la tasa actual de BCV y guardarla. */
  async fetchFromBcv(): Promise<ExchangeRate> {
    const { data } = await api.post<ExchangeRate>("/exchange-rate/fetch");
    return data;
  },
};
