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

/** Genera el PDF del recibo de la asociación en memoria. */
export function generateReceiptPdf(
  payment: Payment,
  receiptNumber: string,
  opts?: {
    condoName?: string;
    condoCity?: string;
    condoAddress?: string;
    condoRif?: string;
    condoPhone?: string;
    issuedAt?: Date;
  },
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
    const condoAddress = (opts?.condoAddress ?? "").trim();
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
    // 130 en vez de 155: cada punto que cede el logo se lo gana la columna
    // central, que es la que decide en cuántas líneas parten nombre y dirección.
    const logoSize = 130;
    const headerY = 0;

    if (hasLogo) {
      doc.image(logoFile, 55, headerY, { fit: [logoSize, logoSize], align: "center", valign: "center" });
    }

    // ── Layout 3 columnas: [logo] [info empresa] [RECIBO N°] ──────────────────
    const col3W = 85;   // alcanza para "RC-00000009" a 12pt
    const col3X = 55 + pageW - col3W;
    const col2X = 55 + (hasLogo ? logoSize + 10 : 0);
    const col2W = col3X - col2X - 8;

    // Encabezado central: se apilan las líneas midiendo el alto real de cada
    // una. El nombre de la asociación y la dirección pueden ocupar 2-3 líneas
    // en esta columna (~212pt), y con offsets fijos de 18pt se solapaban.
    const meta = [condoRif ? `RIF ${condoRif}` : "", condoPhone ? `Tlf. ${condoPhone}` : ""]
      .filter(Boolean).join("  ·  ");

    // La dirección es la línea más larga: se busca el mayor tamaño que la deje
    // en 2 líneas como máximo. Con una dirección corta se queda en 8pt; con una
    // larga baja hasta 6pt antes que dejarla ocupar media página.
    const addrSize = (() => {
      if (!condoAddress) return 8;
      for (const size of [8, 7.5, 7, 6.5, 6]) {
        doc.fontSize(size).font("Helvetica-Bold");
        const alto = doc.heightOfString(condoAddress, { width: col2W, align: "center" });
        if (alto / doc.heightOfString("X", { width: col2W }) <= 2.2) return size;
      }
      return 6;
    })();

    // Orden: título, nombre, dirección, y al final RIF/teléfono.
    const headerLines = [
      { text: "RECIBO DE PAGO", size: 11, gap: 4 },
      { text: condoName, size: 10, gap: 3 },
      { text: condoAddress, size: addrSize, gap: 3 },
      { text: meta, size: 9, gap: 0 },
    ].filter((l) => l.text);

    const measured = headerLines.map((l) => {
      doc.fontSize(l.size).font("Helvetica-Bold");
      return { ...l, h: doc.heightOfString(l.text, { width: col2W, align: "center" }) };
    });

    const textBlockH = measured.reduce((s, l) => s + l.h + l.gap, 0);
    // Math.max(0): con un bloque más alto que el logo, centrarlo daría una Y
    // negativa y el texto se saldría por arriba de la página.
    const textStartY = headerY + Math.max(0, Math.round((logoSize - textBlockH) / 2));

    // Todo el encabezado va en negrita, incluida la dirección.
    let lineY = textStartY;
    const lineYs: number[] = [];
    for (const l of measured) {
      doc.fontSize(l.size).fillColor("#000000").font("Helvetica-Bold")
        .text(l.text, col2X, lineY, { width: col2W, align: "center" });
      lineYs.push(lineY);
      lineY += l.h + l.gap;
    }

    // RECIBO N° — columna derecha, alineado con las dos primeras líneas
    const numLabelY = lineYs[0] ?? textStartY;
    const numValueY = lineYs[1] ?? numLabelY + 18;
    doc.fontSize(8).fillColor("#000000").font("Helvetica-Bold")
      .text("RECIBO N°:", col3X, numLabelY, { width: col3W, align: "right" });
    doc.fontSize(12).fillColor("#000000").font("Helvetica-Bold")
      .text(receiptNumber, col3X, numValueY, { width: col3W, align: "right" });

    // Resetear cursor al margen izquierdo para que el cuerpo quede alineado a la izquierda
    doc.y = headerY + logoSize + 2;
    doc.x = 55;

    // Línea separadora
    doc.moveTo(55, doc.y).lineTo(55 + pageW, doc.y).strokeColor("#cbd5e1").stroke();
    doc.moveDown(1.2);

    // Fecha
    doc.fontSize(10).fillColor("#000000").font("Helvetica-Bold")
      .text(dateStr, { align: "left" });
    doc.moveDown(1);

    // ── Cuerpo ─────────────────────────────────────────────────────────────────
    const owner = payment.submittedBy?.fullName ?? "—";
    const unit = payment.property?.code ?? "—";
    const tower = (payment.property as any)?.tower?.name ?? "";
    const unitFull = tower ? `${unit} · ${tower}` : unit;
    const period = charge?.period ? formatPeriod(charge.period) : "—";
    const concepto = charge?.description ?? "Cuota de Recuperacion";

    doc.fontSize(11).fillColor("#000000");
    doc.font("Helvetica-Bold").text("Recibo de: ", { continued: true }).font("Helvetica").text(owner);
    doc.font("Helvetica-Bold").text("Del apartamento: ", { continued: true }).font("Helvetica").text(unitFull);
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

    // Mora sumada en Monto base — no se desglosa por separado
    const rows: Row[] = [
      { label: "Monto", bsAmt: bsTotal, eurAmt: total },
      { label: "TOTAL", bsAmt: bsTotal, eurAmt: total, bold: true, highlight: true },
    ];

    for (const row of rows) {
      if (row.highlight) {
        doc.rect(tableX, ty, tableW, rowH).fillColor("#f1f5f9").fill();
      }
      const textY = ty + (rowH - (row.bold ? 12 : 10)) / 2;

      // Columna label
      doc.fillColor(row.bold ? "#000000" : "#000000")
        .font(row.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(row.bold ? 12 : 10)
        .text(row.label, tableX + 8, textY, { width: labelW });

      if (bsTotal !== null) {
        // Columna Bs (principal)
        const bsText = row.bsAmt != null ? `Bs. ${bs(row.bsAmt)}` : "—";
        doc.fillColor("#000000")
          .font(row.bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(row.bold ? 12 : 10)
          .text(bsText, tableX + labelW, textY, { width: bsW, align: "right" });

        // Columna EUR (referencia, más pequeña)
        doc.fillColor("#000000")
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(`REF ${eur(row.eurAmt)}`, tableX + labelW + bsW, textY, { width: eurW - 8, align: "right" });
      } else {
        // Sin Bs — solo EUR a la derecha
        doc.fillColor("#000000")
          .font(row.bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(row.bold ? 12 : 10)
          .text(`REF ${eur(row.eurAmt)}`, tableX + labelW, textY, { width: bsW + eurW - 8, align: "right" });
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
      doc.fontSize(7.5).fillColor("#000000").font("Helvetica-Bold")
        .text(
          `Tasa de cambio aplicada: Bs. ${tasaFmt.format(exRate)}`,
          55, doc.y, { width: pageW, align: "center" }
        );
      doc.moveDown(0.4);
    }
    doc.fontSize(7.5).fillColor("#000000").font("Helvetica-Bold")
      .text(
        "Este recibo no es de carácter fiscal. Acredita el pago de la cuota de recuperacion para el período especificado.",
        55, doc.y, { width: pageW, align: "center" }
      );
    doc.fontSize(7.5).fillColor("#000000").font("Helvetica-Bold")
      .text(
        "El pago no libera al propietario de adeudos de períodos anteriores.",
        55, doc.y + 2, { width: pageW, align: "center" }
      );

    // ── Firma / Sello ──────────────────────────────────────────────────────────
    const firmaCandidates = [
      path.join(process.cwd(), "assets", "FIRMA.png"),
      path.join(__dirname, "..", "..", "assets", "FIRMA.png"),
      path.join(__dirname, "..", "assets", "FIRMA.png"),
      path.join(__dirname, "assets", "FIRMA.png"),
    ];
    const firmaFile = firmaCandidates.find((p) => fs.existsSync(p)) ?? "";
    if (firmaFile) {
      const firmaW = 180;
      doc.moveDown(1);
      doc.image(firmaFile, 55 + (pageW - firmaW) / 2, doc.y, { width: firmaW });
    }

    doc.end();
  });
}
