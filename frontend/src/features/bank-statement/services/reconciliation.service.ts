import { api } from "@/services/api";

export interface ConfirmedMatch {
  bankRef: string;
  bankAmount: number;
  bankDate?: string;
  paymentId: string;
  ownerName: string;
  propertyCode: string;
}

export interface ReviewMatch {
  bankRef: string;
  bankAmount: number;
  bankDate?: string;
  paymentId: string;
  ownerName: string;
  propertyCode: string;
  reason: string;
}

export interface UnmatchedRow {
  bankRef: string;
  bankAmount: number;
  bankDate?: string;
  bankDesc?: string;
}

export interface ReconciliationResult {
  newEntries: number;
  duplicates: number;
  confirmed: ConfirmedMatch[];
  review: ReviewMatch[];
  unmatched: UnmatchedRow[];
  totalRows: number;
}

export interface BankEntry {
  id: string;
  referencia: string;
  monto: number;
  fecha?: string;
  descripcion?: string;
  matched: boolean;
  uploadedAt: string;
}

export const reconciliationService = {
  async reconcile(file: File): Promise<ReconciliationResult> {
    const form = new FormData();
    form.append("statement", file);
    const { data } = await api.post<ReconciliationResult>(
      "/bank-statements/reconcile",
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },

  async listEntries(): Promise<BankEntry[]> {
    const { data } = await api.get<BankEntry[]>("/bank-statements/entries");
    return data;
  },

  async deleteEntries(ids: string[]): Promise<void> {
    await api.delete("/bank-statements/entries", { data: { ids } });
  },

  async reconcilePending(): Promise<{ confirmed: number; review: number }> {
    const { data } = await api.post<{ confirmed: number; review: number }>("/bank-statements/reconcile-pending");
    return data;
  },
};
