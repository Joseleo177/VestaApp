import { api } from "@/services/api";
import { Payment } from "@/types/domain";
import { PaymentFormValues } from "../schema";

/** Capa de datos del módulo de pagos. */
export const paymentService = {
  /** Historial de pagos del copropietario autenticado. */
  async listMine(): Promise<Payment[]> {
    const { data } = await api.get<Payment[]>("/payments/me");
    return data;
  },

  /** Cola de pagos pendientes de validación (admin). */
  async listPending(): Promise<Payment[]> {
    const { data } = await api.get<Payment[]>("/payments/pending");
    return data;
  },

  /** Todos los pagos del sistema (admin). */
  async listAll(status?: string): Promise<Payment[]> {
    const params = status ? `?status=${status}` : "";
    const { data } = await api.get<Payment[]>(`/payments${params}`);
    return data;
  },

  /** Registra el pago de una cuota. */
  async create(values: PaymentFormValues): Promise<Payment> {
    const { data } = await api.post<Payment>("/payments", {
      chargeId: values.chargeId,
      currency: values.currency,
      bank: values.modalidad,
      reference: values.reference ?? "",
      paymentDate: values.paymentDate,
      amountBs: values.amountBs,
    });
    return data;
  },

  async confirm(paymentId: string): Promise<void> {
    await api.post(`/payments/${paymentId}/confirm`);
  },

  async confirmPartial(paymentId: string, amount: number): Promise<void> {
    await api.post(`/payments/${paymentId}/confirm-partial`, { amount });
  },

  async reject(paymentId: string, reason: string): Promise<void> {
    await api.post(`/payments/${paymentId}/reject`, { reason });
  },

  async delete(paymentId: string): Promise<void> {
    await api.delete(`/payments/${paymentId}`);
  },

  /** Descarga el recibo PDF como blob y dispara la descarga en el navegador. */
  async downloadReceipt(paymentId: string, receiptNumber: string): Promise<void> {
    const { data } = await api.get<Blob>(
      `/payments/${paymentId}/receipt?rn=${encodeURIComponent(receiptNumber)}`,
      { responseType: "blob" }
    );
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${receiptNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
