import { api } from "@/services/api";
import { Charge, ChargeType } from "@/types/domain";

export interface PeriodSummary {
  period: string;
  count: number;
  total: number;
  hasSpecial: boolean;
}

export interface GenerateChargesInput {
  period: string;
  amount: number;
  moraAmount: number;
  dueDate: string;
  type: ChargeType;
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

  async listForPeriod(period: string): Promise<Charge[]> {
    const { data } = await api.get<Charge[]>(`/charges/period/${period}`);
    return data;
  },

  async generate(input: GenerateChargesInput): Promise<GenerateResult> {
    const { data } = await api.post<GenerateResult>("/charges/generate", input);
    return data;
  },

  async listForProperty(propertyId: string): Promise<Charge[]> {
    const { data } = await api.get<Charge[]>(`/charges/property/${propertyId}`);
    return data;
  },

  async deletePeriod(period: string): Promise<void> {
    await api.delete(`/charges/period/${period}`);
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
