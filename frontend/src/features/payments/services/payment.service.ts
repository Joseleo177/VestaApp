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
      chargeIds: values.chargeIds,
      currency: values.currency,
      bank: values.modalidad,
      reference: values.reference ?? "",
      paymentDate: values.paymentDate,
      amountBs: values.amountBs,
    });
    return data;
  },

  /** `allowSettled`: confirmar aunque sus cuotas ya estén pagadas (ver `useSettledGuard`). */
  async confirm(paymentId: string, allowSettled = false): Promise<void> {
    await api.post(`/payments/${paymentId}/confirm`, { allowSettled });
  },

  async confirmPartial(paymentId: string, amount: number, allowSettled = false): Promise<void> {
    await api.post(`/payments/${paymentId}/confirm-partial`, { amount, allowSettled });
  },

  async reject(paymentId: string, reason: string): Promise<void> {
    await api.post(`/payments/${paymentId}/reject`, { reason });
  },

  /**
   * Elimina un pago. Si tocó cuotas con recibo, el backend exige `voidReason`
   * (error `RECEIPTS_ISSUED`) y en vez de borrar lo anula junto con sus recibos;
   * entonces devuelve el mensaje con los recibos anulados y reemitidos.
   */
  async delete(paymentId: string, voidReason?: string): Promise<string | null> {
    const res = await api.delete<{ message?: string } | "">(`/payments/${paymentId}`, {
      data: voidReason ? { voidReason } : undefined,
    });
    return res.data && typeof res.data === "object" ? res.data.message ?? null : null;
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
