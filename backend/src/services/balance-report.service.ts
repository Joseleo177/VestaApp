import * as XLSX from "xlsx";
import { AppDataSource } from "../config/data-source";
import { Charge, ChargeStatus, ChargeType } from "../models/Charge";
import { Property } from "../models/Property";
import { SettingsService } from "./settings.service";

/**
 * Balance general / relación de pagos: una fila por departamento y una columna
 * por cuota del año (cada mes y cada cuota especial), con lo que falta por
 * pagar de cada una. Replica la planilla que llevaba la junta a mano.
 */

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const OPEN = [ChargeStatus.PENDING, ChargeStatus.PARTIAL];
const EPS = 0.005;

interface ChargeRow {
  propertyId: string;
  period: string;
  description: string;
  type: ChargeType;
  status: ChargeStatus;
  currency: string;
  amount: string;
  mora: string;
  paid: string;
}

interface Column {
  key: string;
  label: string;
  period: string;
  special: boolean;
}

/** Lo que falta por pagar de una cuota; 0 si está pagada o exonerada. */
function owed(c: ChargeRow): number {
  if (!OPEN.includes(c.status)) return 0;
  const n = Number(c.amount) + Number(c.mora) - Number(c.paid);
  return n > EPS ? Math.round(n * 100) / 100 : 0;
}

const symbolOf = (currency: string) => (currency === "USD" ? "$" : "€");
/** Formato de Excel con el símbolo de la tasa; el cero se ve como "-", igual que en la planilla. */
const fmt = (sym: string) => `"${sym} "#,##0.00;-"${sym} "#,##0.00;"${sym} -"`;

/** Torre en el orden en que se cargó el padrón, luego número de apartamento. */
function sortProperties(props: Property[]): Property[] {
  const towerTime = (p: Property) => (p.tower?.createdAt ? new Date(p.tower.createdAt).getTime() : Infinity);
  return [...props].sort(
    (a, b) =>
      towerTime(a) - towerTime(b) ||
      (a.tower?.name ?? "").localeCompare(b.tower?.name ?? "", "es") ||
      a.code.localeCompare(b.code, "es", { numeric: true })
  );
}

export const BalanceReportService = {
  async build(year: number): Promise<{ buffer: Buffer; fileName: string }> {
    const start = `${year}-01`;
    const end = `${year + 1}-01`;

    // Todas las cuotas del año (también las pagadas: definen las columnas) y
    // las de años anteriores que siguen abiertas (la deuda arrastrada).
    const charges: ChargeRow[] = await AppDataSource.getRepository(Charge)
      .createQueryBuilder("c")
      .select("c.property_id", "propertyId")
      .addSelect("c.period", "period")
      .addSelect("c.description", "description")
      .addSelect("c.type", "type")
      .addSelect("c.status", "status")
      .addSelect("c.currency", "currency")
      .addSelect("c.amount", "amount")
      .addSelect("c.mora_amount", "mora")
      .addSelect("c.amount_paid", "paid")
      .where("c.period < :end", { end })
      .andWhere("(c.period >= :start OR c.status IN (:...open))", { start, open: OPEN })
      .getRawMany();

    const properties = sortProperties(await AppDataSource.getRepository(Property).find());
    const [condoName, primary] = await Promise.all([
      SettingsService.get("condo_name"),
      SettingsService.get("rate_primary"),
    ]);
    const primarySym = symbolOf(primary);

    // ── Columnas: un mes por período con cuota ordinaria, y una por cada cuota
    // especial (por período y concepto), en orden cronológico.
    const colMap = new Map<string, Column>();
    const colKey = (c: ChargeRow) =>
      c.type === ChargeType.SPECIAL ? `S|${c.period}|${c.description.trim()}` : `R|${c.period}`;
    for (const c of charges) {
      if (c.period < start) continue;
      const key = colKey(c);
      if (colMap.has(key)) continue;
      const special = c.type === ChargeType.SPECIAL;
      colMap.set(key, {
        key,
        period: c.period,
        special,
        label: special ? c.description.trim() : MONTHS[Number(c.period.slice(5, 7)) - 1] ?? c.period,
      });
    }
    const columns = [...colMap.values()].sort(
      (a, b) =>
        a.period.localeCompare(b.period) ||
        Number(a.special) - Number(b.special) ||
        a.label.localeCompare(b.label, "es")
    );
    // Una misma cuota especial en dos meses ("Cuota ascensores") se distingue por el mes.
    for (const col of columns.filter((c) => c.special)) {
      if (columns.some((o) => o !== col && o.special && o.label === col.label)) {
        col.label = `${col.label} (${MONTHS[Number(col.period.slice(5, 7)) - 1]?.toLowerCase()})`;
      }
    }

    // ── Montos por departamento y columna.
    interface Cell { amount: number; currencies: Set<string> }
    const byProp = new Map<string, { prior: Cell; cols: Map<string, Cell> }>();
    const cellOf = (pid: string) => {
      let e = byProp.get(pid);
      if (!e) byProp.set(pid, (e = { prior: { amount: 0, currencies: new Set() }, cols: new Map() }));
      return e;
    };
    for (const c of charges) {
      const n = owed(c);
      const e = cellOf(c.propertyId);
      let cell: Cell;
      if (c.period < start) cell = e.prior;
      else {
        const k = colKey(c);
        cell = e.cols.get(k) ?? { amount: 0, currencies: new Set() };
        e.cols.set(k, cell);
      }
      cell.amount += n;
      cell.currencies.add(c.currency);
    }
    const symOfCell = (cell?: Cell) =>
      cell && cell.currencies.size === 1 ? symbolOf([...cell.currencies][0]!) : primarySym;

    // ── Hoja principal.
    const priorLabel = `Deuda hasta ${year - 1}`;
    const header = ["Propietario", "Apto", priorLabel, ...columns.map((c) => c.label), `Deuda total ${year}`];
    const today = new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const aoa: unknown[][] = [
      [`${condoName || "Asociación"} — Relación de pagos ${year}`],
      [`Lo que falta por pagar de cada cuota, al ${today}. Celda vacía: no tiene esa cuota; "-": pagada o exonerada.`],
      [],
      header,
    ];
    const HEADER_ROW = 3;
    const firstData = HEADER_ROW + 1;

    // Formatos por celda, para aplicarlos después de crear la hoja.
    const formats: { r: number; c: number; sym: string }[] = [];
    const colTotals = new Array(columns.length + 2).fill(0) as number[];
    const towerSummary = new Map<string, { units: number; debtors: number; debt: number }>();

    properties.forEach((p, i) => {
      const r = firstData + i;
      const e = byProp.get(p.id);
      const row: unknown[] = [p.owner?.fullName ?? "", p.code];

      const prior = e?.prior.amount ?? 0;
      row.push(e && e.prior.currencies.size ? prior : null);
      if (e && e.prior.currencies.size) formats.push({ r, c: 2, sym: symOfCell(e.prior) });
      colTotals[0]! += prior;

      let total = prior;
      columns.forEach((col, j) => {
        const cell = e?.cols.get(col.key);
        row.push(cell ? cell.amount : null);
        if (cell) {
          formats.push({ r, c: 3 + j, sym: symOfCell(cell) });
          total += cell.amount;
          colTotals[1 + j]! += cell.amount;
        }
      });
      total = Math.round(total * 100) / 100;
      row.push(total);
      formats.push({ r, c: 3 + columns.length, sym: primarySym });
      colTotals[columns.length + 1]! += total;
      aoa.push(row);

      const t = towerSummary.get(p.tower?.name ?? "Sin torre") ?? { units: 0, debtors: 0, debt: 0 };
      t.units++;
      if (total > EPS) t.debtors++;
      t.debt += total;
      towerSummary.set(p.tower?.name ?? "Sin torre", t);
    });

    const totalRow = firstData + properties.length;
    aoa.push(["Total", `${properties.length} aptos`, ...colTotals.map((n) => Math.round(n * 100) / 100)]);
    colTotals.forEach((_, j) => formats.push({ r: totalRow, c: 2 + j, sym: primarySym }));

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    for (const f of formats) {
      const ref = XLSX.utils.encode_cell({ r: f.r, c: f.c });
      if (ws[ref]) ws[ref].z = fmt(f.sym);
    }
    ws["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 15 }, ...columns.map((c) => ({ wch: Math.max(12, Math.min(22, c.label.length + 2)) })), { wch: 16 }];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
    ];
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: HEADER_ROW, c: 0 }, e: { r: totalRow - 1, c: header.length - 1 } }) };

    // ── Resumen por torre.
    const summary: unknown[][] = [
      [`Resumen por torre — ${year}`],
      [],
      ["Torre", "Apartamentos", "Con deuda", "Al día", "Deuda total"],
    ];
    let units = 0, debtors = 0, debt = 0;
    for (const [name, t] of towerSummary) {
      summary.push([name, t.units, t.debtors, t.units - t.debtors, Math.round(t.debt * 100) / 100]);
      units += t.units; debtors += t.debtors; debt += t.debt;
    }
    summary.push(["Total", units, debtors, units - debtors, Math.round(debt * 100) / 100]);
    const ws2 = XLSX.utils.aoa_to_sheet(summary);
    for (let r = 3; r < summary.length; r++) {
      const ref = XLSX.utils.encode_cell({ r, c: 4 });
      if (ws2[ref]) ws2[ref].z = fmt(primarySym);
    }
    ws2["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 16 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Relación ${year}`);
    XLSX.utils.book_append_sheet(wb, ws2, "Resumen");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return { buffer, fileName: `balance_general_${year}.xlsx` };
  },
};
