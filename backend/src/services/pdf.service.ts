import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { Payment } from "../models/Payment";
import type { Charge } from "../models/Charge";

/** Una cuota saldada por el pago y la tasa con que se pasa a Bs (null: sin Bs). */
export interface ReceiptLine {
  charge: Charge;
  bsRate: number | null;
}

const CURRENCY_WORD: Record<string, string> = { USD: "dólar", EUR: "euro" };

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
  chargeOverride?: import("../models/Charge").Charge | null,
  /** Cuotas que ampara el recibo; con más de una se listan todas. */
  lines?: ReceiptLine[]
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
    const charge = lines?.[0]?.charge ?? chargeOverride ?? payment.charge;
    const multi = (lines?.length ?? 0) > 1;

    const base = charge ? Number(charge.amount) : Number(payment.amount);
    const mora = charge ? Number(charge.moraAmount) : 0;
    const moraPaid = charge ? Number(charge.amountPaid) > base + 0.01 : false;
    const total = moraPaid ? base + mora : base;
    // La tasa del pago es la de la moneda de su cuota destino. Una cuota cerrada
    // en cascada con otra moneda se convirtió con otra tasa: ahí no se muestra
    // un equivalente en Bs que sería falso, solo la referencia en divisas.
    const rateCurrency = payment.rateCurrency ?? "EUR";
    const sameRate = !charge || (charge.currency ?? "EUR") === rateCurrency;
    // Con `lines` la tasa de cada cuota ya viene resuelta (incluida la de otra moneda).
    const exRate = lines?.length
      ? lines[0].bsRate
      : payment.exchangeRate && sameRate ? Number(payment.exchangeRate) : null;
    // Tasas a citar al pie: una por moneda presente.
    const footerRates: [string, number][] = lines?.length
      ? [...new Map(
          lines
            .filter((l) => l.bsRate)
            .map((l) => [l.charge.currency ?? "EUR", l.bsRate as number] as [string, number])
        ).entries()]
      : exRate ? [[rateCurrency, exRate]] : [];
    // Bs total proporcional a esta cuota
    const bsTotal = exRate ? Math.round(total * exRate * 100) / 100
      : payment.amountBs && sameRate ? Number(payment.amountBs) : null;

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
    const owner = payment.property?.owner?.fullName ?? payment.submittedBy?.fullName ?? "—";
    // El apartamento es el de la cuota: un pago puede saldar cuotas de otro
    // departamento del mismo titular.
    const propOf = (c?: Charge | null) => (c?.property ?? payment.property) as any;
    const unitName = (p: any) => {
      const code = p?.code ?? "—";
      return p?.tower?.name ? `${code} · ${p.tower.name}` : code;
    };
    const unitFull = multi
      ? [...new Set(lines!.map((l) => unitName(propOf(l.charge))))].join(", ")
      : unitName(propOf(charge));
    const period = charge?.period ? formatPeriod(charge.period) : "—";
    const concepto = charge?.description ?? "Cuota de Recuperacion";

    doc.fontSize(11).fillColor("#000000");
    doc.font("Helvetica-Bold").text("Recibo de: ", { continued: true }).font("Helvetica").text(owner);
    doc.font("Helvetica-Bold").text(multi ? "Apartamentos: " : "Del apartamento: ", { continued: true }).font("Helvetica").text(unitFull);
    if (multi) {
      doc.font("Helvetica-Bold").text("Cuotas pagadas: ", { continued: true }).font("Helvetica").text(String(lines!.length));
    } else {
      doc.font("Helvetica-Bold").text(`${concepto}: `, { continued: true }).text(period);
    }
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

    // Cuota cerrada con saldo condonado: se ve lo que costaba, lo perdonado y
    // lo que de verdad se pagó.
    const writeOff = charge ? Number(charge.writeOffAmount ?? 0) : 0;
    if (writeOff > 0) {
      const paid = Number(charge!.amountPaid);
      const expected = Math.round((paid + writeOff) * 100) / 100;
      const toBs = (n: number) => (exRate ? Math.round(n * exRate * 100) / 100 : null);
      rows.splice(0, rows.length,
        { label: "Monto de la cuota", bsAmt: toBs(expected), eurAmt: expected },
        { label: "Saldo condonado", bsAmt: toBs(writeOff), eurAmt: writeOff },
        { label: "TOTAL PAGADO", bsAmt: toBs(paid), eurAmt: paid, bold: true, highlight: true },
      );
    }

    // Varias cuotas: una fila por cuota (departamento · período, y el concepto
    // debajo) y el TOTAL. Cada una con la tasa de su moneda.
    const totalOf = (c: Charge) => {
      const b = Number(c.amount);
      const m = Number(c.moraAmount);
      return Number(c.amountPaid) > b + 0.01 ? b + m : b;
    };
    const multiRows: (Row & { sub?: string })[] = multi
      ? lines!.map((l) => {
          const t = totalOf(l.charge);
          return {
            label: `${propOf(l.charge)?.code ?? "—"} · ${formatPeriod(l.charge.period)}`,
            sub: l.charge.description,
            bsAmt: l.bsRate ? Math.round(t * l.bsRate * 100) / 100 : null,
            eurAmt: t,
          };
        })
      : [];
    if (multi) {
      const sumRef = Math.round(multiRows.reduce((a, r) => a + r.eurAmt, 0) * 100) / 100;
      const allBs = multiRows.every((r) => r.bsAmt != null);
      const sumBs = allBs ? Math.round(multiRows.reduce((a, r) => a + (r.bsAmt ?? 0), 0) * 100) / 100 : null;
      rows.splice(0, rows.length, ...multiRows, {
        label: "TOTAL", bsAmt: sumBs, eurAmt: sumRef, bold: true, highlight: true,
      });
    }
    const hasBs = multi ? rows.some((r) => r.bsAmt != null) : bsTotal !== null;

    for (const row of rows as (Row & { sub?: string })[]) {
      if (row.highlight) {
        doc.rect(tableX, ty, tableW, rowH).fillColor("#f1f5f9").fill();
      }
      const textY = ty + (rowH - (row.bold ? 12 : 10)) / 2 - (row.sub ? 5 : 0);

      // Columna label
      doc.fillColor(row.bold ? "#000000" : "#000000")
        .font(row.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(row.bold ? 12 : 10)
        .text(row.label, tableX + 8, textY, { width: labelW - 8, lineBreak: false, ellipsis: true });
      if (row.sub) {
        doc.fillColor("#475569").font("Helvetica").fontSize(7.5)
          .text(row.sub, tableX + 8, textY + 12, { width: labelW - 8, lineBreak: false, ellipsis: true });
      }

      if (hasBs) {
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

      ty += rowH + (row.sub ? 6 : 0);
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
    if (writeOff > 0 && charge?.writeOffReason) {
      // Una sola cadena: PDFKit no centra bien un texto `continued` con dos fuentes.
      doc.fontSize(8).fillColor("#000000").font("Helvetica-Bold")
        .text(`Motivo de la condonación: ${charge.writeOffReason}`, 55, doc.y, { width: pageW, align: "center" });
      doc.moveDown(0.4);
    }
    const credit = Number(payment.creditAmount ?? 0);
    if (multi && credit > 0) {
      doc.fontSize(8).fillColor("#000000").font("Helvetica-Bold")
        .text(`Saldo a favor abonado con este pago: REF ${eur(credit)}`, 55, doc.y, { width: pageW, align: "center" });
      doc.moveDown(0.4);
    }
    if (footerRates.length > 0) {
      const tasaFmt = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      const txt = footerRates
        .map(([cur, r]) => `Bs. ${tasaFmt.format(r)} por ${CURRENCY_WORD[cur] ?? cur}`)
        .join("  ·  ");
      doc.fontSize(7.5).fillColor("#000000").font("Helvetica-Bold")
        .text(`Tasa BCV aplicada: ${txt}`, 55, doc.y, { width: pageW, align: "center" });
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
