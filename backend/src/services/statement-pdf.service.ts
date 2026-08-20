import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { User } from "../models/User";
import { Charge, ChargeStatus } from "../models/Charge";
import { Property } from "../models/Property";
import { amountDue, isOverdue } from "./charge.service";

// Usa las mismas funciones y variables de tu pdf.service actual
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

export function generateAccountStatementPdf(
  user: User,
  properties: Property[],
  charges: Charge[],
  balance: number,
  creditBalance: number,
  opts?: {
    condoName?: string;
    condoCity?: string;
    condoAddress?: string;
    condoRif?: string;
    condoPhone?: string;
  }
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

    const today = new Date();
    const dateStr = `${city}, ${today.getDate()} de ${MESES[today.getMonth()]} de ${today.getFullYear()}`;

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
    const logoSize = 130;
    const headerY = 0;

    if (hasLogo) {
      doc.image(logoFile, 55, headerY, { fit: [logoSize, logoSize], align: "center", valign: "center" });
    }

    const col2X = 55 + (hasLogo ? logoSize + 10 : 0);
    const col2W = pageW - (hasLogo ? logoSize + 10 : 0);

    const meta = [condoRif ? `RIF ${condoRif}` : "", condoPhone ? `Tlf. ${condoPhone}` : ""]
      .filter(Boolean).join("  ·  ");

    const addrSize = (() => {
      if (!condoAddress) return 8;
      for (const size of [8, 7.5, 7, 6.5, 6]) {
        doc.fontSize(size).font("Helvetica-Bold");
        const alto = doc.heightOfString(condoAddress, { width: col2W, align: "center" });
        if (alto / doc.heightOfString("X", { width: col2W }) <= 2.2) return size;
      }
      return 6;
    })();

    const headerLines = [
      { text: "ESTADO DE CUENTA", size: 12, gap: 4 },
      { text: condoName, size: 10, gap: 3 },
      { text: condoAddress, size: addrSize, gap: 3 },
      { text: meta, size: 9, gap: 0 },
    ].filter((l) => l.text);

    const measured = headerLines.map((l) => {
      doc.fontSize(l.size).font("Helvetica-Bold");
      return { ...l, h: doc.heightOfString(l.text, { width: col2W, align: "center" }) };
    });

    const textBlockH = measured.reduce((s, l) => s + l.h + l.gap, 0);
    const textStartY = headerY + Math.max(0, Math.round((logoSize - textBlockH) / 2));

    let lineY = textStartY;
    for (const l of measured) {
      doc.fontSize(l.size).fillColor("#000000").font("Helvetica-Bold")
        .text(l.text, col2X, lineY, { width: col2W, align: "center" });
      lineY += l.h + l.gap;
    }

    doc.y = headerY + logoSize + 2;
    doc.x = 55;

    doc.moveTo(55, doc.y).lineTo(55 + pageW, doc.y).strokeColor("#cbd5e1").stroke();
    doc.moveDown(1.2);

    doc.fontSize(10).fillColor("#000000").font("Helvetica-Bold").text(dateStr, { align: "right" });
    doc.moveDown(1);

    // ── Datos del Cliente ──────────────────────────────────────────────────────
    const propsStr = properties.map(p => `${p.tower?.name || ''} ${p.code}`.trim()).join(", ") || "—";
    
    doc.fontSize(11).font("Helvetica-Bold").text("Propietario: ", { continued: true }).font("Helvetica").text(user.fullName);
    doc.font("Helvetica-Bold").text("Cédula: ", { continued: true }).font("Helvetica").text(user.cedula);
    doc.font("Helvetica-Bold").text("Propiedades: ", { continued: true }).font("Helvetica").text(propsStr);
    doc.moveDown(1.5);

    // ── Resumen ────────────────────────────────────────────────────────────────
    const tableX = 55;
    const tableW = pageW;
    const rowH = 26;
    
    doc.fontSize(12).font("Helvetica-Bold").text("Resumen de Cuenta", { align: "center" });
    doc.moveDown(0.5);

    let ty = doc.y;
    doc.rect(tableX, ty, tableW, rowH).fillColor("#f1f5f9").fill();
    
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(10).text("Saldo a Favor (EUR)", tableX + 8, ty + 8, { width: tableW/2 });
    doc.text(eur(creditBalance), tableX + tableW/2, ty + 8, { width: tableW/2 - 8, align: "right" });
    ty += rowH;
    
    doc.rect(tableX, ty, tableW, rowH).fillColor("#fef2f2").fill();
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(10).text("Deuda Total (EUR)", tableX + 8, ty + 8, { width: tableW/2 });
    doc.text(eur(balance), tableX + tableW/2, ty + 8, { width: tableW/2 - 8, align: "right" });
    ty += rowH;

    doc.rect(tableX, ty - rowH * 2, tableW, rowH * 2).strokeColor("#cbd5e1").stroke();
    doc.y = ty;

    doc.moveDown(2);

    // ── Detalle de Cuotas ──────────────────────────────────────────────────────
    doc.fontSize(12).font("Helvetica-Bold").text("Detalle de Cuotas", { align: "center" });
    doc.moveDown(0.5);

    const detailX = 55;
    const colPeriod = 80;
    const colDesc = 140;
    const colStatus = 70;
    const colMonto = 80;
    const colDeuda = 80;
    
    // Header tabla cuotas
    ty = doc.y;
    doc.rect(detailX, ty, tableW, rowH).fillColor("#f8fafc").fill();
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(9);
    
    let cx = detailX + 4;
    doc.text("Período", cx, ty + 8, { width: colPeriod }); cx += colPeriod;
    doc.text("Descripción", cx, ty + 8, { width: colDesc }); cx += colDesc;
    doc.text("Estado", cx, ty + 8, { width: colStatus }); cx += colStatus;
    doc.text("Total Cuota", cx, ty + 8, { width: colMonto, align: "right" }); cx += colMonto;
    doc.text("Deuda", cx, ty + 8, { width: colDeuda, align: "right" });
    ty += rowH;
    
    doc.font("Helvetica").fontSize(9);
    for (const c of charges) {
        if (ty > doc.page.height - 100) {
            doc.addPage();
            ty = 55;
        }

        const totalCuota = Number(c.amount) + Number(c.moraAmount);
        const deuda = amountDue(c);
        
        let status = c.status as string;
        if (c.status === ChargeStatus.PENDING && isOverdue(c)) {
            status = "VENCIDA";
        } else if (c.status === ChargeStatus.PENDING) {
            status = "PENDIENTE";
        } else if (c.status === ChargeStatus.PAID) {
            status = "PAGADA";
        } else if (c.status === ChargeStatus.PARTIAL) {
            status = "PARCIAL";
        } else if (c.status === ChargeStatus.EXONERATED) {
            status = "EXONERADA";
        }

        cx = detailX + 4;
        doc.text(c.period, cx, ty + 8, { width: colPeriod }); cx += colPeriod;
        doc.text(c.description || "Cuota", cx, ty + 8, { width: colDesc }); cx += colDesc;
        doc.text(status, cx, ty + 8, { width: colStatus }); cx += colStatus;
        doc.text(eur(totalCuota), cx, ty + 8, { width: colMonto, align: "right" }); cx += colMonto;
        doc.text(eur(deuda), cx, ty + 8, { width: colDeuda, align: "right" });
        
        doc.moveTo(detailX, ty + rowH).lineTo(detailX + tableW, ty + rowH).strokeColor("#e2e8f0").stroke();
        ty += rowH;
    }
    
    doc.rect(detailX, doc.y, tableW, ty - doc.y).strokeColor("#cbd5e1").stroke();
    
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
      doc.y = ty;
      doc.moveDown(2);
      if (doc.y > doc.page.height - 150) {
          doc.addPage();
      }
      doc.image(firmaFile, 55 + (pageW - firmaW) / 2, doc.y, { width: firmaW });
    }

    doc.end();
  });
}
