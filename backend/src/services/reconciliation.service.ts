import * as XLSX from "xlsx";
import { AppDataSource } from "../config/data-source";
import { Payment, PaymentCurrency, PaymentStatus } from "../models/Payment";
import { BankEntry } from "../models/BankEntry";
import { User } from "../models/User";
import { PaymentService } from "./payment.service";

export interface ConfirmedMatch {
  bankRef: string;
  bankAmount: number;
  bankDate?: string;
  paymentId: string;
  ownerName: string;
  propertyCode: string;
}

export interface ReviewMatch {
  bankRef: string;
  bankAmount: number;
  bankDate?: string;
  paymentId: string;
  ownerName: string;
  propertyCode: string;
  reason: string;
}

export interface UnmatchedRow {
  bankRef: string;
  bankAmount: number;
  bankDate?: string;
  bankDesc?: string;
}

export interface ReconciliationResult {
  newEntries: number;
  duplicates: number;
  confirmed: ConfirmedMatch[];
  review: ReviewMatch[];
  unmatched: UnmatchedRow[];
  totalRows: number;
}

function normalizeRef(s: string): string {
  return s.trim().replace(/^'+/, "").replace(/\s/g, "").toLowerCase();
}

const MIN_SUFFIX = 6;

function refsMatch(a: string, b: string): boolean {
  const na = normalizeRef(a);
  const nb = normalizeRef(b);
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer  = na.length <= nb.length ? nb : na;
  return shorter.length >= MIN_SUFFIX && longer.endsWith(shorter);
}

/** Quita tildes y pasa a minúsculas para comparar encabezados. */
function stripAccents(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function detectColumns(headers: string[]): {
  refCol: string;
  amountCol: string;
  dateCol?: string;
  descCol?: string;
} {
  const norm = headers.map(stripAccents);

  const find = (patterns: string[]) => {
    for (const pat of patterns) {
      const idx = norm.findIndex((h) => h.includes(pat));
      if (idx !== -1) return headers[idx];
    }
    return undefined;
  };

  const refCol = find(["referencia", "nro. ref", "nro ref", "numero ref", "ref"]);
  // Priorizar crédito/abono sobre débito/cargo; "monto" solo como último recurso
  const amountCol = find(["credito", "abono", "haber", "monto acreditado", "monto"]);
  const dateCol = find(["fecha"]);
  const descCol = find(["concepto", "descripcion", "descripcion", "detalle"]);

  if (!refCol)
    throw new Error("No se encontro columna de referencia. Columnas: " + headers.join(", "));
  if (!amountCol)
    throw new Error("No se encontro columna de monto. Columnas: " + headers.join(", "));

  return { refCol, amountCol, dateCol, descCol };
}

/** Convierte cualquier formato de fecha a YYYY-MM-DD. */
function parseDate(value: unknown): string | undefined {
  // Objeto Date real (de cellDates: true + raw: true) — más confiable.
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return undefined;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const s = String(value ?? "").trim();
  if (!s || s === "0") return undefined;

  // DD/MM/YYYY o D/M/YYYY o D/M/YY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    const day = dmy[1]!.padStart(2, "0");
    const month = dmy[2]!.padStart(2, "0");
    let year = dmy[3]!;
    if (year.length === 2) year = `20${year}`;
    // Validar rangos básicos
    if (Number(month) > 12 || Number(day) > 31) return undefined;
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Número serial de Excel (días desde 1900-01-00)
  const num = Number(s);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(epoch.getTime() + num * 86400000);
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  return undefined;
}

function parseAmount(value: unknown): number {
  if (typeof value === "number") return Math.abs(value);
  const str = String(value ?? "").trim();
  const clean = str.replace(/[^\d,.-]/g, "");
  if (!clean) return 0;
  if (clean.includes(",") && clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
    return Math.abs(parseFloat(clean.replace(/\./g, "").replace(",", ".")));
  }
  return Math.abs(parseFloat(clean.replace(/,/g, "")));
}

export function amountMatchesBankEntry(
  payment: Payment,
  bankMonto: number
): boolean {
  const tol = 0.02;
  if (payment.currency === PaymentCurrency.BS && payment.amountBs != null) {
    return Math.abs(Number(payment.amountBs) - bankMonto) <= tol;
  }
  return Math.abs(Number(payment.amount) - bankMonto) <= tol;
}

export const ReconciliationService = {
  async reconcile(buffer: Buffer, adminId: string): Promise<ReconciliationResult> {
    // raw: false → texto formateado (preserva ceros a la izquierda en referencias)
    const wbText = XLSX.read(buffer, { type: "buffer", cellText: true, cellDates: false });
    // raw: true + cellDates: true → objetos Date reales para celdas de fecha (evita dependencia del locale del servidor)
    const wbDates = XLSX.read(buffer, { type: "buffer", cellText: false, cellDates: true });

    const sheet = wbText.Sheets[wbText.SheetNames[0]!]!;
    const sheetDates = wbDates.Sheets[wbDates.SheetNames[0]!]!;

    const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    // Filas con valores nativos (Date objects para fechas)
    const allRowsRaw: unknown[][] = XLSX.utils.sheet_to_json(sheetDates, {
      header: 1,
      defval: "",
      raw: true,
    });

    if (allRows.length === 0) throw new Error("El archivo esta vacio");

    // El extracto puede tener filas de metadata antes de los headers reales.
    // Buscamos la fila que contenga "Referencia" (hasta las primeras 5 filas).
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(5, allRows.length); i++) {
      const row = allRows[i] as string[];
      if (row.some((cell) => stripAccents(String(cell)).includes("referencia"))) {
        headerRowIdx = i;
        break;
      }
    }

    const headers = (allRows[headerRowIdx] as string[]).map(String);
    const dataRows = allRows.slice(headerRowIdx + 1) as unknown[][];
    const dataRowsRaw = allRowsRaw.slice(headerRowIdx + 1) as unknown[][];

    const { refCol, amountCol, dateCol, descCol } = detectColumns(headers);
    const dateColIdx = dateCol ? headers.indexOf(dateCol) : -1;

    interface ParsedRow {
      referencia: string;
      monto: number;
      fecha?: string;
      descripcion?: string;
    }

    const parsed: ParsedRow[] = dataRows
      .map((row, i) => {
        // Para la fecha usamos el valor raw (Date object) para evitar errores de locale.
        const rawDateValue = dateColIdx >= 0 ? (dataRowsRaw[i] ?? [])[dateColIdx] : undefined;
        return {
          referencia: String(row[headers.indexOf(refCol)] ?? "").trim(),
          monto: parseAmount(row[headers.indexOf(amountCol)]),
          fecha: dateCol ? parseDate(rawDateValue ?? row[headers.indexOf(dateCol)]) : undefined,
          descripcion: descCol ? String(row[headers.indexOf(descCol)] ?? "").trim() || undefined : undefined,
        };
      })
      .filter((r) => r.referencia !== "" && r.monto > 0);

    const entryRepo = AppDataSource.getRepository(BankEntry);
    const adminRef = { id: adminId } as User;

    let newEntries = 0;
    let duplicates = 0;

    // Persist rows — skip those whose referencia already exists
    for (const row of parsed) {
      const existing = await entryRepo.findOneBy({
        referencia: normalizeRef(row.referencia),
      });
      if (existing) {
        duplicates++;
        continue;
      }
      const entry = entryRepo.create({
        referencia: normalizeRef(row.referencia),
        monto: row.monto,
        fecha: row.fecha,
        descripcion: row.descripcion,
        uploadedBy: adminRef,
      });
      await entryRepo.save(entry);
      newEntries++;
    }

    // Match new entries against PENDING payments
    const pending = await AppDataSource.getRepository(Payment).find({
      where: { status: PaymentStatus.PENDING },
      relations: { receipts: true },
    });

    const result: ReconciliationResult = {
      newEntries,
      duplicates,
      confirmed: [],
      review: [],
      unmatched: [],
      totalRows: parsed.length,
    };

    const matchedIds = new Set<string>();

    for (const row of parsed) {
      const refMatch = pending.find(
        (p) =>
          !matchedIds.has(p.id) &&
          refsMatch(p.reference, row.referencia)
      );

      if (!refMatch) {
        result.unmatched.push({
          bankRef: normalizeRef(row.referencia),
          bankAmount: row.monto,
          bankDate: row.fecha,
          bankDesc: row.descripcion,
        });
        continue;
      }

      if (amountMatchesBankEntry(refMatch, row.monto)) {
        try {
          await PaymentService.confirm(refMatch.id, adminId);
          matchedIds.add(refMatch.id);
          result.confirmed.push({
            bankRef: normalizeRef(row.referencia),
            bankAmount: row.monto,
            bankDate: row.fecha,
            paymentId: refMatch.id,
            ownerName: refMatch.submittedBy?.fullName ?? "-",
            propertyCode: refMatch.property?.code ?? "-",
          });
        } catch {
          result.review.push({
            bankRef: normalizeRef(row.referencia),
            bankAmount: row.monto,
            bankDate: row.fecha,
            paymentId: refMatch.id,
            ownerName: refMatch.submittedBy?.fullName ?? "-",
            propertyCode: refMatch.property?.code ?? "-",
            reason: "Error al confirmar automaticamente",
          });
        }
      } else {
        const registrado =
          refMatch.currency === PaymentCurrency.BS && refMatch.amountBs != null
            ? `Bs. ${Number(refMatch.amountBs).toLocaleString("es-VE")}`
            : `EUR ${Number(refMatch.amount).toFixed(2)}`;
        result.review.push({
          bankRef: normalizeRef(row.referencia),
          bankAmount: row.monto,
          bankDate: row.fecha,
          paymentId: refMatch.id,
          ownerName: refMatch.submittedBy?.fullName ?? "-",
          propertyCode: refMatch.property?.code ?? "-",
          reason: `Referencia coincide pero monto difiere (registrado: ${registrado})`,
        });
      }
    }

    return result;
  },

  /**
   * Llamado al crear un pago nuevo: si ya existe una bank_entry con la misma
   * referencia y monto, confirma el pago automaticamente.
   */
  async tryAutoConfirm(payment: Payment): Promise<boolean> {
    try {
      const ref = normalizeRef(payment.reference);
      if (ref.length < MIN_SUFFIX) return false;

      const entry = await AppDataSource.getRepository(BankEntry)
        .createQueryBuilder("be")
        .where("be.matched = false")
        .andWhere("(be.referencia = :ref OR be.referencia LIKE :suffix)", {
          ref,
          suffix: `%${ref}`,
        })
        .getOne();

      if (!entry) return false;
      if (!amountMatchesBankEntry(payment, Number(entry.monto))) return false;

      await PaymentService.confirm(payment.id, null);
      return true;
    } catch {
      return false;
    }
  },

  /** Intenta reconciliar todos los pagos PENDING contra entradas bancarias libres. */
  async reconcilePending(): Promise<{ confirmed: number; review: number }> {
    const pending = await AppDataSource.getRepository(Payment).find({
      where: { status: PaymentStatus.PENDING },
      relations: { charge: true, property: { owner: true } },
    });

    let confirmed = 0;
    let review = 0;

    for (const payment of pending) {
      const ref = normalizeRef(payment.reference);
      if (ref.length < MIN_SUFFIX) continue;

      const entry = await AppDataSource.getRepository(BankEntry)
        .createQueryBuilder("be")
        .where("be.matched = false")
        .andWhere("(be.referencia = :ref OR be.referencia LIKE :suffix)", {
          ref,
          suffix: `%${ref}`,
        })
        .getOne();

      if (!entry) continue;

      if (amountMatchesBankEntry(payment, Number(entry.monto))) {
        try {
          await PaymentService.confirm(payment.id, null);
          confirmed++;
        } catch { /* ya confirmado o error */ }
      } else {
        review++;
      }
    }

    return { confirmed, review };
  },
};
