import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { Payment } from "../models/Payment";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
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
  opts?: { condoName?: string; condoCity?: string; condoRif?: string; condoPhone?: string; issuedAt?: Date },
  chargeOverride?: import("../models/Charge").Charge | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 55 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const condoName = opts?.condoName ?? "Centro Residencial Plaza Mayor";
    const city = opts?.condoCity ?? "Barquisimeto";
    const condoRif = opts?.condoRif ?? "";
    const condoPhone = opts?.condoPhone ?? "";
    const charge = chargeOverride ?? payment.charge;

    const base = charge ? Number(charge.amount) : Number(payment.amount);
    const mora = charge ? Number(charge.moraAmount) : 0;
    const moraPaid = charge ? Number(charge.amountPaid) > base + 0.01 : false;
    const total = moraPaid ? base + mora : base;
    const exRate = payment.exchangeRate ? Number(payment.exchangeRate) : null;
    // Bs total proporcional a esta cuota
    const bsTotal = exRate ? Math.round(total * exRate * 100) / 100
      : payment.amountBs ? Number(payment.amountBs) : null;
    const bsBase = exRate ? Math.round(base * exRate * 100) / 100 : null;
    const bsMora = (exRate && mora > 0) ? Math.round(mora * exRate * 100) / 100 : null;

    // Usar la fecha declarada del pago (cuando se hizo la transferencia), no la de hoy.
    // Se añade T12:00:00 para evitar desfases de zona horaria con fechas tipo "YYYY-MM-DD".
    const payDate = payment.paymentDate
      ? new Date(`${payment.paymentDate}T12:00:00`)
      : (opts?.issuedAt ?? new Date());
    const dateStr = `${city}, ${payDate.getDate()} de ${MESES[payDate.getMonth()]} de ${payDate.getFullYear()}`;

    // ── Encabezado ────────────────────────────────────────────────────────────
    const pageW = doc.page.width - 110;
    const logoCandidates = [
      path.join(process.cwd(), "assets", "LOGO.png"),
      path.join(__dirname, "..", "..", "assets", "LOGO.png"),
      path.join(__dirname, "..", "assets", "LOGO.png"),
      path.join(__dirname, "assets", "LOGO.png"),
    ];
    const logoFile = logoCandidates.find((p) => fs.existsSync(p)) ?? "";
    const hasLogo = logoFile !== "";
    const logoSize = 105;
    const headerY = 45;

    if (hasLogo) {
      doc.image(logoFile, 55, headerY, { fit: [logoSize, logoSize], align: "center", valign: "center" });
    }

    // ── Layout 3 columnas: [logo] [info empresa] [RECIBO N°] ──────────────────
    const col3W = 100;
    const col3X = 55 + pageW - col3W;
    const col2X = 55 + (hasLogo ? logoSize + 10 : 0);
    const col2W = col3X - col2X - 8;

    // Info empresa — centrada en columna central
    doc.fontSize(11).fillColor("#1e293b").font("Helvetica-Bold")
      .text("RECIBO DE PAGO", col2X, headerY + 10, { width: col2W, align: "center" });
    doc.fontSize(10).fillColor("#475569").font("Helvetica")
      .text(condoName, col2X, headerY + 30, { width: col2W, align: "center" });
    if (condoRif || condoPhone) {
      const meta = [condoRif ? `RIF ${condoRif}` : "", condoPhone ? `Tlf. ${condoPhone}` : ""]
        .filter(Boolean).join("  ·  ");
      doc.fontSize(9).fillColor("#334155").font("Helvetica")
        .text(meta, col2X, headerY + 46, { width: col2W, align: "center" });
    }

    // RECIBO N° — columna derecha
    doc.fontSize(8).fillColor("#334155").font("Helvetica")
      .text("RECIBO N°", col3X, headerY + 24, { width: col3W, align: "right" });
    doc.fontSize(12).fillColor("#1e293b").font("Helvetica-Bold")
      .text(receiptNumber, col3X, headerY + 38, { width: col3W, align: "right" });

    // Resetear cursor al margen izquierdo para que el cuerpo quede alineado a la izquierda
    doc.y = headerY + logoSize + 16;
    doc.x = 55;

    // Línea separadora
    doc.moveTo(55, doc.y).lineTo(55 + pageW, doc.y).strokeColor("#cbd5e1").stroke();
    doc.moveDown(1.2);

    // Fecha
    doc.fontSize(10).fillColor("#334155").font("Helvetica")
      .text(dateStr, { align: "left" });
    doc.moveDown(1);

    // ── Cuerpo ─────────────────────────────────────────────────────────────────
    const owner = payment.submittedBy?.fullName ?? "—";
    const unit = payment.property?.code ?? "—";
    const tower = (payment.property as any)?.tower?.name ?? "";
    const unitFull = tower ? `${unit} · ${tower}` : unit;
    const period = charge?.period ? formatPeriod(charge.period) : "—";
    const concepto = charge?.description ?? "Cuota de Recuperacion";

    doc.fontSize(11).fillColor("#1e293b");
    doc.font("Helvetica").text("Recibo de: ", { continued: true }).font("Helvetica-Bold").text(owner);
    doc.font("Helvetica").text("Del apartamento: ", { continued: true }).font("Helvetica-Bold").text(unitFull);
    doc.font("Helvetica-Bold").text(`${concepto}: `, { continued: true }).text(period);
    doc.moveDown(1.2);

    // ── Tabla de montos ────────────────────────────────────────────────────────
    const tableX = 55;
    const tableW = pageW;
    const rowH = 26;
    const labelW = tableW * 0.40;
    const bsW = tableW * 0.35;
    const eurW = tableW * 0.25;
    const tableStartY = doc.y;
    let ty = tableStartY;


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
        doc.fillColor("#334155")
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

    // ── Pie — justo debajo de la tabla ────────────────────────────────────────
    doc.moveDown(1);
    doc.moveTo(55, doc.y).lineTo(55 + pageW, doc.y).strokeColor("#cbd5e1").stroke();
    doc.moveDown(0.5);
    if (exRate) {
      const tasaFmt = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      doc.fontSize(7.5).fillColor("#475569").font("Helvetica")
        .text(
          `Tasa de cambio aplicada: Bs. ${tasaFmt.format(exRate)} / EUR`,
          55, doc.y, { width: pageW, align: "center" }
        );
      doc.moveDown(0.4);
    }
    doc.fontSize(7.5).fillColor("#475569").font("Helvetica")
      .text(
        "Este recibo no es de carácter fiscal. Acredita el pago de la cuota de recuperacion para el período especificado.",
        55, doc.y, { width: pageW, align: "center" }
      );
    doc.fontSize(7.5).fillColor("#475569").font("Helvetica")
      .text(
        "El pago no libera al propietario de adeudos de períodos anteriores.",
        55, doc.y + 2, { width: pageW, align: "center" }
      );

    doc.end();
  });
}
