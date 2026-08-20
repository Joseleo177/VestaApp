import { api } from "@/services/api";

export const ReportService = {
  async downloadCollectedPayments(startDate: string, endDate: string): Promise<void> {
    const res = await api.get("/reports/collected", {
      params: { startDate, endDate },
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reporte_cobros_${startDate}_al_${endDate}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  async downloadOwedCharges(): Promise<void> {
    const res = await api.get("/reports/debt", {
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reporte_deudas.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  async downloadAccountStatement(userId?: string) {
    const url = userId ? `/reports/statement?userId=${userId}` : "/reports/statement";
    const res = await api.get(url, { responseType: "blob" });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const blobUrl = window.URL.createObjectURL(blob);
    
    let filename = `estado_de_cuenta_${userId || 'mio'}.pdf`;
    const disposition = res.headers["content-disposition"];
    if (disposition && disposition.indexOf("filename=") !== -1) {
      const matches = /filename="([^"]+)"/.exec(disposition);
      if (matches != null && matches[1]) {
        filename = matches[1];
      }
    }

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  }
};
