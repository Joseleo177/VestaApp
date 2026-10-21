import { api } from "@/services/api";
import { PaymentCurrency } from "@/types/domain";

/** Un recibo emitido, con lo necesario para listarlo y descargarlo. */
export interface ReceiptRow {
  id: string;
  receiptNumber: string;
  issuedAt: string;
  issuedBy: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  payment: {
    id: string;
    amount: number;
    currency: PaymentCurrency;
    amountBs: number | null;
    paymentDate: string;
    bank: string;
    reference: string;
  } | null;
  property: { id: string; code: string; tower: string | null; owner: string | null } | null;
  /** Cuotas que ampara (todas las que dejó saldadas su pago). */
  charges: { id: string; period: string; description: string }[];
}

export const receiptService = {
  async list(): Promise<ReceiptRow[]> {
    const { data } = await api.get<ReceiptRow[]>("/receipts");
    return data;
  },
};
