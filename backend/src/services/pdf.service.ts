import PDFDocument from "pdfkit";
import { Payment, PaymentCurrency } from "../models/Payment";

const eur = new Intl.NumberFormat("es-VE", { style: "currency", currency: "EUR" });
const bs = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Genera el PDF del recibo en memoria y devuelve el Buffer. No escribe en disco. */
export function generateReceiptPdf(payment: Payment, receiptNumber: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // --- Encabezado ---
    doc.fontSize(20).text("Recibo de Pago", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#666").text(`Nº ${receiptNumber}`, { align: "center" });
    doc.moveDown(1.5);

    // --- Datos del copropietario y propiedad ---
    doc.fillColor("#000").fontSize(12);
    doc.text(`Copropietario: ${payment.submittedBy.fullName}`);
    doc.text(`Unidad: ${payment.property.code}`);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString("es-VE")}`);
    doc.moveDown(1);

    // --- Detalle de la transacción ---
    doc.fontSize(13).text("Detalle del pago", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Referencia: ${payment.reference}`);
    doc.text(`Banco / medio: ${payment.bank}`);
    doc.text(`Fecha de pago: ${payment.paymentDate}`);
    if (payment.charge) {
      doc.text(`Concepto: ${payment.charge.description} (${payment.charge.period})`);
    }
    const isBs = payment.currency === PaymentCurrency.BS;
    doc.text(`Tipo de pago: ${isBs ? "Bolívares (Bs)" : "Divisas (€)"}`);
    if (isBs && payment.exchangeRate) {
      doc.text(`Tasa BCV aplicada: Bs. ${bs.format(Number(payment.exchangeRate))} / €`);
    }
    doc.moveDown(1);

    // --- Monto ---
    doc.fontSize(16).fillColor("#1a7f37");
    doc.text(`Monto confirmado: ${eur.format(Number(payment.amount))}`);
    if (isBs && payment.amountBs) {
      doc.fontSize(12).fillColor("#475569");
      doc.text(`Equivalente: Bs. ${bs.format(Number(payment.amountBs))}`);
    }
    doc.fillColor("#000").moveDown(2);

    // --- Pie ---
    doc.fontSize(9).fillColor("#999").text(
      "Documento generado automáticamente por CondoApp. Válido como constancia de pago confirmado por la administración.",
      { align: "center" }
    );

    doc.end();
  });
}
