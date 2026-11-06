import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { Payment, PaymentCurrency } from "../models/Payment";
import { ChargeType, type Charge } from "../models/Charge";
import { formatDocumentId } from "../models/User";

/** Un aporte a una cuota: un abono, un uso del saldo a favor o el pago que la cerró. */
export interface ReceiptPart {
  paymentId: string;
  /** "Transferencia en Bs", "Efectivo en divisas", "Saldo a favor"… */
  modality: string;
  paymentDate: string | null;
  reference: string | null;
  /** Lo que aportó, en divisas. */
  amount: number;
  /** Los Bs que se pagaron por ese aporte (null si no fue en Bs). */
  bs: number | null;
  rate: number | null;
  /** Se entregaron dólares: el monto va con "$". */
  paidInDivisas: boolean;
}

/** Una cuota saldada por el pago y la tasa con que se pasa a Bs (null: sin Bs). */
export interface ReceiptLine {
  charge: Charge;
  bsRate: number | null;
  /** Todo lo que entró a la cuota, en orden. Vacío en pagos sin registro de aplicaciones. */
  parts?: ReceiptPart[];
}

/**
 * Cómo se pagó, dicho para el vecino. El campo `bank` del pago guarda la
 * modalidad del formulario (Efectivo / Transferencia); datos viejos pueden
 * traer otra palabra (p. ej. "Pago móvil"), que se respeta.
 */
export function paymentModality(p: { fromCredit?: boolean; bank?: string | null; currency: PaymentCurrency }): string {
  if (p.fromCredit) return "Saldo a favor";
  const raw = (p.bank ?? "").trim();
  const how = !raw || /^transferencia$/i.test(raw) ? "Transferencia" : /^efectivo$/i.test(raw) ? "Efectivo" : raw;
  return `${how} en ${p.currency === PaymentCurrency.BS ? "Bs" : "divisas"}`;
}

/** "2026-11-06" → "06/11/2026". */
function shortDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
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
/**
 * Lo que se cobró por una cuota pagada: la base, o base + mora si lo pagado pasó
 * de la base. Una cuota con precio en Bs pudo pagarse a cualquiera de los dos
 * precios: vale lo pagado, sin pasar del máximo posible.
 */
function chargeTotal(c: Charge): number {
  const b = Number(c.amount);
  const m = Number(c.moraAmount);
  const paid = Number(c.amountPaid);
  if (Number(c.bsPrice ?? 0) > 0 && paid > 0.01) {
    return Math.min(paid, Math.max(b, Number(c.bsPrice)) + m);
  }
  return paid > b + 0.01 ? b + m : b;
}

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
    /** Recibo anulado: se imprime con sello y el motivo. */
    voided?: { at: Date; reason: string | null } | null;
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
    // Un recibo anulado cuya cuota se anuló después no toma otra cuota del pago.
    const charge = lines?.[0]?.charge ?? chargeOverride ?? (opts?.voided ? null : payment.charge);
    const multi = (lines?.length ?? 0) > 1;

    const base = charge ? Number(charge.amount) : Number(payment.amount);
    const total = charge ? chargeTotal(charge) : base;
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
    // Los montos en divisas van redondeados a centavos, así que monto × tasa se aleja de lo
    // transferido hasta media centésima por tasa (24.000 Bs / 466,6014 = 51,44
    // divisas, y 51,44 × 466,6014 = 24.001,98). Si la diferencia es solo ese
    // redondeo, el recibo muestra los Bs que de verdad se pagaron.
    const transferredBs =
      payment.currency === PaymentCurrency.BS && payment.amountBs != null ? Number(payment.amountBs) : null;
    // Pagado en $: los montos en divisas llevan "$". Pagado en Bs, cada monto
    // lleva el símbolo de la moneda de su cuota (€ o $), que es la de su tasa.
    // Con saldo a favor no se entregaron dólares: va en la moneda de la cuota.
    const paidInDivisas = payment.currency === PaymentCurrency.DIVISAS && !payment.fromCredit;
    const symOf = (cur?: string | null) =>
      paidInDivisas ? "$ " : cur === "USD" ? "$ " : cur === "EUR" ? "€ " : "";
    const div = (n: number, cur?: string | null) => `${symOf(cur)}${eur(n)}`;
    const snapBs = (computed: number | null, rateSum: number): number | null =>
      computed != null && transferredBs != null && Math.abs(computed - transferredBs) <= rateSum * 0.005 + 0.01
        ? transferredBs
        : computed;

    // Bs total proporcional a esta cuota
    const bsTotal = exRate ? snapBs(Math.round(total * exRate * 100) / 100, exRate)
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

    // ── Aportes ──
    // La tabla dice con qué se pagó: un renglón por aporte con su modalidad,
    // fecha, referencia y los Bs que de verdad se pagaron. En un recibo de
    // varias cuotas solo se abren las pagadas en partes (abonos, saldo a favor)
    // o cerradas con dinero de otro pago; las demás llevan la modalidad debajo.
    const needsBreakdown = (parts?: ReceiptPart[]): parts is ReceiptPart[] =>
      !!parts?.length && (parts.length > 1 || parts[0].paymentId !== payment.id);
    const paymentHow = [paymentModality(payment), !payment.fromCredit && payment.reference ? `Ref. ${payment.reference}` : ""]
      .filter(Boolean)
      .join(" · ");

    // ── Cuerpo ─────────────────────────────────────────────────────────────────
    const ownerUser = payment.property?.owner ?? payment.submittedBy;
    const owner = ownerUser?.fullName ?? "—";
    // La cédula se guarda solo en dígitos; en el recibo va con su letra y puntos.
    const ownerCi = ownerUser?.cedula ? formatDocumentId(ownerUser.cedulaTipo, ownerUser.cedula, false) : null;
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
    if (ownerCi) {
      doc.font("Helvetica-Bold").text("C.I./RIF: ", { continued: true }).font("Helvetica").text(ownerCi);
    }
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


    type Row = {
      label: string; bsAmt?: number | null; eurAmt: number; bold?: boolean; highlight?: boolean;
      /** Moneda de la tasa del monto en divisas (USD/EUR); null = mezcla, sin símbolo. */
      cur?: string | null;
      /** Segunda línea, más pequeña, bajo la etiqueta. */
      sub?: string;
      /** Aporte a una cuota: lleva el símbolo de su propia moneda. */
      part?: boolean;
      /** Aporte bajo la fila de su cuota (recibo de varias): sangrado y más pequeño. */
      nested?: boolean;
    };

    const rateFmt = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    const partRow = (p: ReceiptPart, chargeCur: string | null | undefined, nested = false): Row => ({
      label: p.modality,
      sub: [
        shortDate(p.paymentDate),
        p.reference ? `Ref. ${p.reference}` : "",
        p.rate ? `Tasa ${rateFmt.format(p.rate)}` : "",
      ].filter(Boolean).join(" · "),
      bsAmt: p.bs,
      eurAmt: p.amount,
      // Dólares entregados: "$"; lo demás, en la moneda de la cuota.
      cur: p.paidInDivisas ? "USD" : chargeCur ?? "EUR",
      part: true,
      nested,
    });
    /** Bs de una cuota según sus aportes: solo si todos fueron en Bs. */
    const partsBs = (parts: ReceiptPart[]) =>
      parts.every((p) => p.bs != null) ? Math.round(parts.reduce((a, p) => a + (p.bs ?? 0), 0) * 100) / 100 : null;

    // Moneda del monto en divisas: la de la cuota (la tasa con que se convierte).
    const singleCur = charge?.currency ?? rateCurrency;

    // Mora sumada en Monto base — no se desglosa por separado
    const rows: Row[] = [
      { label: "Monto", bsAmt: bsTotal, eurAmt: total, cur: singleCur },
      { label: "TOTAL", bsAmt: bsTotal, eurAmt: total, cur: singleCur, bold: true, highlight: true },
    ];

    // Cuota cerrada con saldo condonado: el recibo solo acredita lo que se
    // pagó. La condonación queda en el sistema, no en el recibo del vecino.
    const writeOff = charge ? Number(charge.writeOffAmount ?? 0) : 0;
    if (writeOff > 0) {
      const paid = Number(charge!.amountPaid);
      const paidBs = exRate ? snapBs(Math.round(paid * exRate * 100) / 100, exRate) : null;
      rows.splice(0, rows.length,
        { label: "Monto", bsAmt: paidBs, eurAmt: paid, cur: singleCur },
        { label: "TOTAL", bsAmt: paidBs, eurAmt: paid, cur: singleCur, bold: true, highlight: true },
      );
    }

    // Una cuota: un renglón por aporte (uno solo si se pagó de una vez) y el total.
    if (!multi) {
      const singleParts = lines?.[0]?.parts;
      const parts: ReceiptPart[] = needsBreakdown(singleParts)
        ? singleParts
        : [{
            // Pagada de una vez (o pago sin registro de aplicaciones): este mismo
            // pago, con los montos de arriba (ya ajustados a lo transferido).
            paymentId: payment.id,
            modality: paymentModality(payment),
            paymentDate: payment.paymentDate ?? null,
            reference: payment.fromCredit ? null : payment.reference || null,
            amount: rows[0].eurAmt,
            bs: rows[0].bsAmt ?? null,
            rate: rows[0].bsAmt != null ? exRate : null,
            paidInDivisas,
          }];
      const paid = Math.round(parts.reduce((a, p) => a + p.amount, 0) * 100) / 100;
      rows.splice(0, rows.length,
        ...parts.map((p) => partRow(p, singleCur)),
        { label: "TOTAL", bsAmt: partsBs(parts), eurAmt: paid, cur: singleCur, bold: true, highlight: true },
      );
    }

    // Varias cuotas: una fila por cuota (departamento · período, y el concepto
    // debajo) y el TOTAL. Cada una con la tasa de su moneda.
    const totalOf = (c: Charge) => {
      // Condonada: vale lo pagado, igual que con una sola cuota.
      if (Number(c.writeOffAmount ?? 0) > 0) return Number(c.amountPaid);
      return chargeTotal(c);
    };
    const multiRows: Row[] = multi
      ? lines!.map((l) => {
          const t = totalOf(l.charge);
          return {
            label: `${propOf(l.charge)?.code ?? "—"} · ${formatPeriod(l.charge.period)}`,
            // Pagada de una vez con este pago: la modalidad va debajo del concepto.
            sub: needsBreakdown(l.parts)
              ? l.charge.description
              : [l.charge.description, paymentHow].filter(Boolean).join(" · "),
            // Pagada en partes: los Bs que de verdad entraron, no la cuota entera a esta tasa.
            bsAmt: needsBreakdown(l.parts)
              ? partsBs(l.parts)
              : l.bsRate ? Math.round(t * l.bsRate * 100) / 100 : null,
            eurAmt: t,
            cur: l.charge.currency ?? "EUR",
          };
        })
      : [];
    if (multi) {
      const sumRef = Math.round(multiRows.reduce((a, r) => a + r.eurAmt, 0) * 100) / 100;
      const allBs = multiRows.every((r) => r.bsAmt != null);
      const rawBs = allBs ? Math.round(multiRows.reduce((a, r) => a + (r.bsAmt ?? 0), 0) * 100) / 100 : null;
      const sumBs = snapBs(rawBs, lines!.reduce((a, l) => a + (l.bsRate ?? 0), 0));
      // La diferencia del redondeo va a la última fila para que sumen el TOTAL.
      if (sumBs != null && rawBs != null && sumBs !== rawBs) {
        const last = multiRows[multiRows.length - 1];
        last.bsAmt = Math.round(((last.bsAmt ?? 0) + sumBs - rawBs) * 100) / 100;
      }
      // El TOTAL lleva símbolo solo si todas las cuotas son de la misma moneda:
      // sumar € y $ no da ni euros ni dólares.
      const curs = new Set(multiRows.map((r) => r.cur));
      // Bajo cada cuota pagada en partes, sus aportes (no suman al TOTAL: ya
      // están en la fila de la cuota).
      const display = multiRows.flatMap((r, i) => {
        const parts = lines![i].parts;
        return needsBreakdown(parts) ? [r, ...parts.map((p) => partRow(p, lines![i].charge.currency, true))] : [r];
      });
      rows.splice(0, rows.length, ...display, {
        label: "TOTAL", bsAmt: sumBs, eurAmt: sumRef, cur: curs.size === 1 ? [...curs][0] : null,
        bold: true, highlight: true,
      });
    }
    const hasBs = rows.some((r) => r.bsAmt != null);

    // Un aporte lleva el símbolo de su propia moneda, sin la regla del pago en $.
    const partMoney = (n: number, cur?: string | null) =>
      `${cur === "USD" ? "$ " : cur === "EUR" ? "€ " : ""}${eur(n)}`;

    for (const row of rows) {
      if (row.highlight) {
        doc.rect(tableX, ty, tableW, rowH).fillColor("#f1f5f9").fill();
      }
      const size = row.bold ? 12 : row.nested ? 9 : 10;
      const textY = ty + (rowH - size) / 2 - (row.sub ? 5 : 0);
      const indent = row.nested ? 22 : 8;
      const money = row.part ? partMoney(row.eurAmt, row.cur) : div(row.eurAmt, row.cur);
      const ink = row.nested ? "#334155" : "#000000";

      // Columna label
      doc.fillColor(ink)
        .font(row.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(size)
        .text(row.label, tableX + indent, textY, { width: labelW - indent, lineBreak: false, ellipsis: true });
      if (row.sub) {
        doc.fillColor("#475569").font("Helvetica").fontSize(7.5)
          .text(row.sub, tableX + indent, textY + size + 2, { width: labelW + bsW * 0.4 - indent, lineBreak: false, ellipsis: true });
      }

      if (hasBs) {
        // Columna Bs (principal)
        const bsText = row.bsAmt != null ? `Bs. ${bs(row.bsAmt)}` : "—";
        doc.fillColor(ink)
          .font(row.bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(size)
          .text(bsText, tableX + labelW, textY, { width: bsW, align: "right" });

        // Columna EUR (referencia, más pequeña)
        doc.fillColor(ink)
          .font(row.nested ? "Helvetica" : "Helvetica-Bold")
          .fontSize(9)
          .text(money, tableX + labelW + bsW, textY, { width: eurW - 8, align: "right" });
      } else {
        // Sin Bs — solo EUR a la derecha
        doc.fillColor(ink)
          .font(row.bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(size)
          .text(money, tableX + labelW, textY, { width: bsW + eurW - 8, align: "right" });
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
    const credit = Number(payment.creditAmount ?? 0);
    if (multi && credit > 0) {
      doc.fontSize(8).fillColor("#000000").font("Helvetica-Bold")
        .text(`Saldo a favor abonado con este pago: ${div(credit)}`, 55, doc.y, { width: pageW, align: "center" });
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
    // El concepto del pie sale del tipo de las cuotas pagadas: una especial
    // no es "de recuperación".
    const paidCharges = multi ? lines!.map((l) => l.charge) : charge ? [charge] : [];
    const allSpecial = paidCharges.length > 0 && paidCharges.every((c) => c.type === ChargeType.SPECIAL);
    const anySpecial = paidCharges.some((c) => c.type === ChargeType.SPECIAL);
    const plural = paidCharges.length > 1;
    const conceptoPie = allSpecial
      ? (plural ? "las cuotas especiales" : "la cuota especial")
      : anySpecial
        ? "las cuotas"
        : (plural ? "las cuotas de recuperación" : "la cuota de recuperación");
    const periodoPie = new Set(paidCharges.map((c) => c.period)).size > 1
      ? "los períodos especificados"
      : "el período especificado";
    doc.fontSize(7.5).fillColor("#000000").font("Helvetica-Bold")
      .text(
        `Este recibo no es de carácter fiscal. Acredita el pago de ${conceptoPie} para ${periodoPie}.`,
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

    // ── Sello de anulación ───────────────────────────────────────────────────
    if (opts?.voided) {
      const cx = doc.page.width / 2;
      const cy = doc.page.height / 2;
      doc.save();
      doc.rotate(-30, { origin: [cx, cy] });
      doc.fillOpacity(0.18).fillColor("#D32F2F").font("Helvetica-Bold").fontSize(110)
        .text("ANULADO", 0, cy - 55, { width: doc.page.width, align: "center", lineBreak: false });
      doc.restore();

      const fecha = opts.voided.at.toLocaleDateString("es-VE");
      doc.fillOpacity(1).fillColor("#D32F2F").font("Helvetica-Bold").fontSize(9)
        .text(
          `RECIBO ANULADO el ${fecha}${opts.voided.reason ? ` — Motivo: ${opts.voided.reason}` : ""}`,
          55, doc.page.height - 90, { width: pageW, align: "center" }
        );
    }

    doc.end();
  });
}
