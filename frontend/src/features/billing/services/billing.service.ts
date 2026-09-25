import { api } from "@/services/api";
import { Charge, ChargeType, RateCurrency } from "@/types/domain";

export interface PeriodSummary {
  period: string;
  count: number;
  total: number;
  hasSpecial: boolean;
  type: ChargeType;
  /** Tasas de cobro presentes en el lote (dos si se mezclaron). */
  currencies: RateCurrency[];
}

export interface GenerateChargesInput {
  period: string;
  amount: number;
  moraAmount: number;
  dueDate: string;
  type: ChargeType;
  currency: RateCurrency;
  towerIds?: string[];
  description?: string;
}

export interface GenerateResult {
  created: number;
}

export const billingService = {
  async listPeriods(): Promise<PeriodSummary[]> {
    const { data } = await api.get<PeriodSummary[]>("/charges/periods");
    return data;
  },

  async listForPeriod(period: string, type?: string): Promise<Charge[]> {
    const { data } = await api.get<Charge[]>(`/charges/period/${period}`, { params: { type } });
    return data;
  },

  async generate(input: GenerateChargesInput): Promise<GenerateResult> {
    const { data } = await api.post<GenerateResult>("/charges/generate", input);
    return data;
  },

  /** Cambia la tasa de las cuotas no pagadas de un lote. */
  async setPeriodCurrency(
    period: string,
    type: ChargeType,
    currency: RateCurrency
  ): Promise<{ updated: number }> {
    const { data } = await api.patch<{ updated: number }>(
      `/charges/period/${period}/currency`,
      { currency },
      { params: { type } }
    );
    return data;
  },

  /** Cambia la tasa de una cuota no pagada. */
  async setChargeCurrency(chargeId: string, currency: RateCurrency): Promise<Charge> {
    const { data } = await api.patch<Charge>(`/charges/${chargeId}/currency`, { currency });
    return data;
  },

  /** Condona el saldo de una cuota con abono parcial. */
  async writeOff(chargeId: string, reason: string): Promise<Charge> {
    const { data } = await api.post<Charge>(`/charges/${chargeId}/write-off`, { reason });
    return data;
  },

  /** Deshace la condonación: la cuota vuelve a parcial. */
  async revertWriteOff(chargeId: string): Promise<Charge> {
    const { data } = await api.delete<Charge>(`/charges/${chargeId}/write-off`);
    return data;
  },

  async listForProperty(propertyId: string): Promise<Charge[]> {
    const { data } = await api.get<Charge[]>(`/charges/property/${propertyId}`);
    return data;
  },

  async deletePeriod(period: string, type?: string): Promise<void> {
    await api.delete(`/charges/period/${period}`, { params: { type } });
  },

  async setExonerated(chargeId: string, exonerated: boolean): Promise<Charge> {
    const { data } = await api.patch<Charge>(`/charges/${chargeId}/exonerate`, {
      exonerated,
    });
    return data;
  },

  async deleteCharge(chargeId: string): Promise<void> {
    await api.delete(`/charges/${chargeId}`);
  },
};
