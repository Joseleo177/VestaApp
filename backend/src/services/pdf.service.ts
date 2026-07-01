import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { Payment } from "../models/Payment";

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
function bs(n: number): string {
  return new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** Genera el PDF del recibo de condominio en memoria. */
export function generateReceiptPdf(
  payment: Payment,
  receiptNumber: string,
  opts?: { condoName?: string; condoCity?: string; condoRif?: string; condoPhone?: string },
  chargeOverride?: import("../models/Charge").Charge | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 55 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const condoName  = opts?.condoName ?? "Condominio";
    const city       = opts?.condoCity ?? "Barquisimeto";
    const condoRif   = opts?.condoRif  ?? "";
    const condoPhone = opts?.condoPhone ?? "";
    const charge     = chargeOverride ?? payment.charge;

    const base     = charge ? Number(charge.amount)     : Number(payment.amount);
    const mora     = charge ? Number(charge.moraAmount) : 0;
    const moraPaid = charge ? Number(charge.amountPaid) > base + 0.01 : false;
    const total    = moraPaid ? base + mora : base;
    const exRate   = payment.exchangeRate ? Number(payment.exchangeRate) : null;
    // Bs total proporcional a esta cuota
    const bsTotal  = exRate ? Math.round(total * exRate * 100) / 100
                   : payment.amountBs ? Number(payment.amountBs) : null;
    const bsBase   = exRate ? Math.round(base * exRate * 100) / 100 : null;
    const bsMora   = (exRate && mora > 0) ? Math.round(mora * exRate * 100) / 100 : null;

    const now      = new Date();
    const dateStr  = `${city}, ${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;

    // ── Encabezado ────────────────────────────────────────────────────────────
    const pageW  = doc.page.width - 110;
    const logoCandidates = [
      path.join(process.cwd(), "assets", "LOGO.png"),
      path.join(__dirname, "..", "..", "assets", "LOGO.png"),
      path.join(__dirname, "..", "assets", "LOGO.png"),
      path.join(__dirname, "assets", "LOGO.png"),
    ];
    const logoFile = logoCandidates.find((p) => fs.existsSync(p)) ?? "";
    const hasLogo  = logoFile !== "";
    const logoSize = 85;
    const headerY  = 45;

    if (hasLogo) {
      doc.image(logoFile, 55, headerY, { width: logoSize, height: logoSize });
    }

    const infoX = hasLogo ? 55 + logoSize + 12 : 55;
    const infoW = pageW - (hasLogo ? logoSize + 12 : 0);

    // Nombre empresa + datos — centrados en el área junto al logo
    doc.fontSize(13).fillColor("#1e293b").font("Helvetica-Bold")
       .text("RECIBO DE ADMINISTRACIÓN Y CONDOMINIO", infoX, headerY + 6, { width: infoW, align: "center" });
    doc.fontSize(10).fillColor("#475569").font("Helvetica")
       .text(condoName, infoX, headerY + 26, { width: infoW, align: "center" });
    if (condoRif || condoPhone) {
      const meta = [condoRif ? `RIF ${condoRif}` : "", condoPhone ? `Tlf. ${condoPhone}` : ""]
        .filter(Boolean).join("  ·  ");
      doc.fontSize(9).fillColor("#64748b").font("Helvetica")
         .text(meta, infoX, headerY + 42, { width: infoW, align: "center" });
    }

    // RECIBO N° centrado en el área del encabezado
    doc.fontSize(11).fillColor("#1e293b").font("Helvetica-Bold")
       .text(`RECIBO N° ${receiptNumber}`, 55, headerY + logoSize + 6, { width: pageW, align: "center" });

    doc.y = headerY + logoSize + 24;

    // Línea separadora
    doc.moveTo(55, doc.y).lineTo(55 + pageW, doc.y).strokeColor("#cbd5e1").stroke();
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
    const concepto = charge?.description ?? "Cuota de condominio";

    doc.fontSize(11).fillColor("#1e293b");
    doc.font("Helvetica").text("Recibí de: ", { continued: true }).font("Helvetica-Bold").text(owner);
    doc.font("Helvetica").text("Del Apto: ", { continued: true }).font("Helvetica-Bold").text(unitFull);
    doc.font("Helvetica-Bold").text(`${concepto}: `, { continued: true }).text(period);
    doc.moveDown(1.2);

    // ── Tabla de montos ────────────────────────────────────────────────────────
    const tableX      = 55;
    const tableW      = pageW;
    const rowH        = 26;
    const labelW      = tableW * 0.40;
    const bsW         = tableW * 0.35;
    const eurW        = tableW * 0.25;
    const tableStartY = doc.y;
    let   ty          = tableStartY;

    // Cabecera de la tabla si hay Bs
    if (bsTotal !== null) {
      doc.rect(tableX, ty, tableW, rowH - 6).fillColor("#e2e8f0").fill();
      doc.fillColor("#64748b").font("Helvetica").fontSize(8)
         .text("CONCEPTO", tableX + 8, ty + 4, { width: labelW });
      doc.fillColor("#64748b").font("Helvetica").fontSize(8)
         .text("MONTO (Bs.)", tableX + labelW, ty + 4, { width: bsW, align: "right" });
      doc.fillColor("#64748b").font("Helvetica").fontSize(8)
         .text("REF. (EUR)", tableX + labelW + bsW, ty + 4, { width: eurW - 8, align: "right" });
      ty += rowH - 6;
      doc.moveTo(tableX, ty).lineTo(tableX + tableW, ty).strokeColor("#cbd5e1").stroke();
    }

    type Row = { label: string; bsAmt?: number | null; eurAmt: number; bold?: boolean; highlight?: boolean };

    const rows: Row[] = [
      { label: "Cuota base", bsAmt: bsBase, eurAmt: base },
    ];
    if (moraPaid && mora > 0) {
      rows.push({ label: "Mora por retraso", bsAmt: bsMora, eurAmt: mora });
    }
    rows.push({ label: "TOTAL", bsAmt: bsTotal, eurAmt: total, bold: true, highlight: true });

    for (const row of rows) {
      if (row.highlight) {
        doc.rect(tableX, ty, tableW, rowH).fillColor("#f1f5f9").fill();
      }
      const textY = ty + (rowH - (row.bold ? 12 : 10)) / 2;

      // Columna label
      doc.fillColor(row.bold ? "#1e293b" : "#475569")
         .font(row.bold ? "Helvetica-Bold" : "Helvetica")
         .fontSize(row.bold ? 12 : 10)
         .text(row.label, tableX + 8, textY, { width: labelW });

      if (bsTotal !== null) {
        // Columna Bs (principal)
        const bsText = row.bsAmt != null ? `Bs. ${bs(row.bsAmt)}` : "—";
        doc.fillColor("#1e293b")
           .font(row.bold ? "Helvetica-Bold" : "Helvetica")
           .fontSize(row.bold ? 12 : 10)
           .text(bsText, tableX + labelW, textY, { width: bsW, align: "right" });

        // Columna EUR (referencia, más pequeña)
        doc.fillColor("#64748b")
           .font("Helvetica")
           .fontSize(9)
           .text(`EUR ${eur(row.eurAmt)}`, tableX + labelW + bsW, textY, { width: eurW - 8, align: "right" });
      } else {
        // Sin Bs — solo EUR a la derecha
        doc.fillColor("#1e293b")
           .font(row.bold ? "Helvetica-Bold" : "Helvetica")
           .fontSize(row.bold ? 12 : 10)
           .text(`EUR ${eur(row.eurAmt)}`, tableX + labelW, textY, { width: bsW + eurW - 8, align: "right" });
      }

      ty += rowH;
      if (!row.highlight) {
        doc.moveTo(tableX, ty).lineTo(tableX + tableW, ty).strokeColor("#e2e8f0").stroke();
      }
    }

    doc.rect(tableX, tableStartY, tableW, ty - tableStartY).strokeColor("#cbd5e1").stroke();
    doc.y = ty;

    // ── Pie ───────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 120;
    doc.moveTo(55, footerY).lineTo(55 + pageW, footerY).strokeColor("#cbd5e1").stroke();
    doc.fontSize(7.5).fillColor("#94a3b8").font("Helvetica")
       .text(
         "Este recibo no es de carácter fiscal. Acredita el pago de la cuota de condominio para el período especificado.",
         55, footerY + 8, { width: pageW, align: "center", lineBreak: false }
       );
    doc.fontSize(7.5).fillColor("#94a3b8").font("Helvetica")
       .text(
         "El pago no libera al propietario de adeudos de períodos anteriores. Generado por VestaApp.",
         55, footerY + 20, { width: pageW, align: "center", lineBreak: false }
       );

    doc.end();
  });
}
