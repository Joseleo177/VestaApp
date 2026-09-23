import { api } from "@/services/api";

export interface ImportPreviewRow {
  line: number;
  codigo: string;
  ownerName: string | null;
  paymentDate: string | null;
  currency: "BS" | "DIVISAS";
  currencyAssumed: boolean;
  reference: string;
  modalidad: string;
  amountBs: number | null;
  amountEur: number | null;
  targetPeriod: string | null;
  targetSettled: boolean;
  periodExplicit: boolean;
  cascadePeriods: string[];
  creditLeft: number;
  willAutoConfirm: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  totalEur: number;
  willConfirm: number;
  chargesSettled: number;
}

export interface ImportResult {
  created: number;
  confirmed: number;
  failed: { line: number; codigo: string; error: string }[];
}

/** Carga de pagos en lote desde una planilla .xlsx (admin). */
export const paymentImportService = {
  /** Descarga la plantilla, que incluye el padrón con la deuda al día. */
  async downloadTemplate(): Promise<void> {
    const { data } = await api.get<Blob>("/payments/import/template", {
      responseType: "blob",
    });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-pagos.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  /** Simula la carga sin escribir nada. */
  async preview(file: File): Promise<ImportPreview> {
    const form = new FormData();
    form.append("sheet", file);
    const { data } = await api.post<ImportPreview>("/payments/import/preview", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /** Crea los pagos de las filas válidas. */
  async commit(file: File): Promise<ImportResult> {
    const form = new FormData();
    form.append("sheet", file);
    const { data } = await api.post<ImportResult>("/payments/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};
