import PDFDocument from "pdfkit";
import { Payment, PaymentCurrency } from "../models/Payment";
import { ChargeStatus } from "../models/Charge";

const MESES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

function formatPeriod(period: string): string {
  const [y, m] = period.split("-");
  return `${MESES[parseInt(m, 10) - 1]} ${y}`;
}

function eur(n: number): string {
  return new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** Genera el PDF del recibo de condominio en memoria. */
export function generateReceiptPdf(
  payment: Payment,
  receiptNumber: string,
  opts?: { condoName?: string; condoCity?: string; condoRif?: string; condoPhone?: string }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 55 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const condoName  = opts?.condoName ?? "Condominio";
    const city       = opts?.condoCity ?? "Caracas";
    const condoRif   = opts?.condoRif  ?? "";
    const condoPhone = opts?.condoPhone ?? "";
    const charge    = payment.charge;

    // Montos de la cuota (lo que debía, no lo que pagó)
    const base      = charge ? Number(charge.amount)     : Number(payment.amount);
    const mora      = charge ? Number(charge.moraAmount) : 0;
    const moraPaid  = charge ? Number(charge.amountPaid) > base + 0.01 : false;
    const total     = moraPaid ? base + mora : base;

    const now       = new Date();
    const dateStr   = `${city}, ${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;
    const isBs      = payment.currency === PaymentCurrency.BS;

    // ── Encabezado ────────────────────────────────────────────────────────────
    const pageW = doc.page.width - 110; // ancho útil

    doc.fontSize(9).fillColor("#64748b")
       .text("VestaApp — Gestión de Condominio", 55, 55, { width: pageW / 2 });

    doc.fontSize(14).fillColor("#1e293b").font("Helvetica-Bold")
       .text(`RECIBO N° ${receiptNumber}`, 55, 52, { width: pageW, align: "right" });

    doc.moveDown(0.3);

    // Línea separadora
    doc.moveTo(55, doc.y).lineTo(55 + pageW, doc.y).strokeColor("#cbd5e1").stroke();
    doc.moveDown(0.8);

    // Título centrado
    doc.fontSize(15).fillColor("#1e293b").font("Helvetica-Bold")
       .text("RECIBO DE ADMINISTRACIÓN Y CONDOMINIO", { align: "center" });
    doc.fontSize(10).font("Helvetica").fillColor("#475569")
       .text(condoName, { align: "center" });
    if (condoRif || condoPhone) {
      const meta = [condoRif ? `RIF ${condoRif}` : "", condoPhone ? `Tlf. ${condoPhone}` : ""]
        .filter(Boolean).join("  ·  ");
      doc.fontSize(9).fillColor("#64748b").text(meta, { align: "center" });
    }
    doc.moveDown(1.2);

    // Fecha
    doc.fontSize(10).fillColor("#334155").font("Helvetica")
       .text(dateStr, { align: "left" });
    doc.moveDown(1);

    // ── Cuerpo ─────────────────────────────────────────────────────────────────
    const owner    = payment.submittedBy?.fullName ?? "—";
    const unit     = payment.property?.code ?? "—";
    const tower    = (payment.property as any)?.tower?.name ?? "";
    const unitFull = tower ? `${unit} · ${tower}` : unit;
    const period   = charge?.period ? formatPeriod(charge.period) : "—";

    doc.fontSize(11).fillColor("#1e293b");
    doc.text("Recibí de: ", { continued: true }).font("Helvetica-Bold").text(owner);
    doc.font("Helvetica").text("Del Apto: ", { continued: true }).font("Helvetica-Bold").text(unitFull);
    doc.font("Helvetica")
       .text("Por concepto de cuota de condominio correspondiente al período: ", { continued: true })
       .font("Helvetica-Bold").text(period);
    doc.moveDown(1.2);

    // ── Tabla de montos ────────────────────────────────────────────────────────
    const tableX     = 55;
    const tableW     = pageW;
    const rowH       = 24;
    const tableStartY = doc.y;
    let   ty          = tableStartY;

    const rows: { label: string; amount: string; bold?: boolean; highlight?: boolean }[] = [
      { label: "Cuota base", amount: `EUR ${eur(base)}` },
    ];
    if (moraPaid && mora > 0) {
      rows.push({ label: "Mora por retraso", amount: `EUR ${eur(mora)}` });
    }
    rows.push({ label: "TOTAL", amount: `EUR ${eur(total)}`, bold: true, highlight: true });

    for (const row of rows) {
      if (row.highlight) {
        doc.rect(tableX, ty, tableW, rowH).fillColor("#f1f5f9").fill();
      }
      doc.fillColor(row.bold ? "#1e293b" : "#475569")
         .font(row.bold ? "Helvetica-Bold" : "Helvetica")
         .fontSize(row.bold ? 12 : 10)
         .text(row.label, tableX + 8, ty + (rowH - 12) / 2, { width: tableW / 2 });
      doc.fillColor("#1e293b")
         .font(row.bold ? "Helvetica-Bold" : "Helvetica")
         .fontSize(row.bold ? 12 : 10)
         .text(row.amount, tableX + tableW / 2, ty + (rowH - 12) / 2,
               { width: tableW / 2 - 8, align: "right" });
      ty += rowH;
      if (!row.highlight) {
        doc.moveTo(tableX, ty).lineTo(tableX + tableW, ty).strokeColor("#e2e8f0").stroke();
      }
    }

    doc.rect(tableX, tableStartY, tableW, ty - tableStartY).strokeColor("#cbd5e1").stroke();

    // sync cursor to after the table then add spacing
    doc.y = ty;
    doc.moveDown(1.5);

    // Detalle del pago (tasa, referencia)
    if (isBs && payment.exchangeRate) {
      doc.fontSize(9).fillColor("#64748b").font("Helvetica")
         .text(`Tasa BCV aplicada: Bs. ${eur(Number(payment.exchangeRate))} / EUR  ·  Monto transferido: Bs. ${payment.amountBs ? eur(Number(payment.amountBs)) : "—"}`);
    }
    if (payment.reference) {
      doc.fontSize(9).fillColor("#64748b")
         .text(`Referencia bancaria: ${payment.reference}  ·  Modalidad: ${payment.bank}`);
    }

    // ── Estado ─────────────────────────────────────────────────────────────────
    if (charge?.status === ChargeStatus.PAID) {
      doc.moveDown(0.6);
      doc.fontSize(9).fillColor("#16a34a").font("Helvetica-Bold")
         .text("✓ Cuota pagada en su totalidad", { align: "center" });
    }

    // ── Pie ────────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 80;
    doc.moveTo(55, footerY).lineTo(55 + pageW, footerY).strokeColor("#cbd5e1").stroke();
    doc.fontSize(7.5).fillColor("#94a3b8").font("Helvetica")
       .text(
         "Este recibo no es de carácter fiscal. Acredita el pago de la cuota de condominio para el período especificado. " +
         "El pago de este recibo no libera al propietario de adeudos de períodos anteriores. Generado por VestaApp.",
         55, footerY + 8, { width: pageW, align: "center" }
       );

    doc.end();
  });
}
