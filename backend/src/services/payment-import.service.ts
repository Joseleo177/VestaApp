import * as XLSX from "xlsx";
import { AppDataSource } from "../config/data-source";
import { Charge, ChargeStatus } from "../models/Charge";
import { Property } from "../models/Property";
import { Payment, PaymentCurrency, PaymentStatus } from "../models/Payment";
import { BankEntry } from "../models/BankEntry";
import { amountDue } from "./charge.service";
import {
  PaymentService,
  allocatePayment,
  chargeRateCurrency,
  ChargeLike,
} from "./payment.service";
import { getRateConfig, getRateForDate } from "./exchange-rate.service";
import { RateCurrency } from "../models/ExchangeRateRecord";
import {
  amountMatchesBankEntry,
  normalizeRef,
  refsMatch,
  MIN_SUFFIX,
} from "./reconciliation.service";
import { findColumn, parseAmount, parseDate, readSheet, stripAccents } from "../utils/sheet";

/* ------------------------------------------------------------------ */
/*  Tipos del resultado                                                */
/* ------------------------------------------------------------------ */

export interface ImportPreviewRow {
  /** Número de fila en el Excel, para que el admin la ubique al corregir. */
  line: number;
  codigo: string;
  ownerName: string | null;
  paymentDate: string | null;
  currency: PaymentCurrency;
  /** La moneda no venía en la fila y se asumió Bs. */
  currencyAssumed: boolean;
  reference: string;
  modalidad: string;
  amountBs: number | null;
  amountEur: number | null;
  /** Cuota a la que se imputa el pago. */
  targetPeriod: string | null;
  targetDescription: string | null;
  /** La cuota destino queda saldada; si es false, el pago es un abono parcial. */
  targetSettled: boolean;
  /** El período venía escrito en la planilla (no se eligió automáticamente). */
  periodExplicit: boolean;
  /** Cuotas adicionales que cierra el excedente, en orden de vencimiento. */
  cascade: { period: string; description: string }[];
  /** Excedente final que queda como saldo a favor del titular. */
  creditLeft: number;
  /** La referencia ya está en el extracto y el monto cuadra → se confirmará sola. */
  willAutoConfirm: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  /** Suma en divisas de las filas válidas. */
  totalEur: number;
  /** Filas que quedarán confirmadas de una vez al casar con el extracto. */
  willConfirm: number;
  /** Cuotas que quedarían totalmente saldadas. */
  chargesSettled: number;
}

export interface ImportResult {
  created: number;
  confirmed: number;
  failed: { line: number; codigo: string; error: string }[];
}

/* ------------------------------------------------------------------ */
/*  Parseo de la planilla                                              */
/* ------------------------------------------------------------------ */

/** Encabezados que genera la plantilla. La detección acepta variantes. */
export const TEMPLATE_HEADERS = [
  "codigo",
  "fecha",
  "moneda",
  "monto",
  "modalidad",
  "referencia",
  "periodo",
  "descripcion",
] as const;

/**
 * El campo `bank` de un pago es la "Modalidad" del formulario, y solo admite
 * estos dos valores (en divisas, únicamente Efectivo). No es el nombre del
 * banco: se acepta el mismo vocabulario cerrado que usa la app.
 */
const MODALIDADES = ["Efectivo", "Transferencia"] as const;

function parseModalidad(value: unknown): string | "UNKNOWN" | null {
  const s = stripAccents(String(value ?? ""));
  if (!s) return null;
  if (s.includes("efec")) return "Efectivo";
  if (s.includes("transf")) return "Transferencia";
  return "UNKNOWN";
}

const MESES: Record<string, number> = {
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

/** "2026-07", "07/2026", "julio 2026", una fecha… todo termina en "YYYY-MM". */
function parsePeriod(value: unknown): string | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  const s = String(value ?? "").trim();
  if (!s) return null;

  const ym = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (ym) return `${ym[1]}-${ym[2]!.padStart(2, "0")}`;

  const my = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (my) return `${my[2]}-${my[1]!.padStart(2, "0")}`;

  const myShort = s.match(/^(\d{1,2})[-/.](\d{2})$/);
  if (myShort) return `20${myShort[2]}-${myShort[1]!.padStart(2, "0")}`;

  // "julio 2026", "jul-26", "jul/2026"
  const named = stripAccents(s).match(/^([a-z]+)[\s\-/.]+(\d{2,4})$/);
  if (named) {
    const mes = MESES[named[1]!];
    if (mes) {
      const year = named[2]!.length === 2 ? `20${named[2]}` : named[2];
      return `${year}-${String(mes).padStart(2, "0")}`;
    }
  }

  // Una fecha completa también sirve: nos quedamos con su mes.
  const asDate = parseDate(s);
  if (asDate) return asDate.slice(0, 7);

  return null;
}

/**
 * Una referencia larga escrita como número en Excel se muestra como
 * "5.02952E+11": el texto formateado de la celda ya no sirve. Cuando pasa eso
 * se usa el valor crudo, que sí conserva el número entero completo. Se prefiere
 * el texto en el resto de los casos porque es el único que preserva los ceros a
 * la izquierda.
 */
function readReference(text: string, raw: unknown): string {
  const clean = text.trim().replace(/^'+/, "");
  if (/^\d*\.?\d+e[+-]?\d+$/i.test(clean) && typeof raw === "number" && isFinite(raw)) {
    return raw.toFixed(0);
  }
  return clean;
}

/** Normaliza texto libre para comparar sin depender de tildes ni espacios. */
function normalizeText(s: string): string {
  return stripAccents(s).replace(/\s+/g, " ").trim();
}

/** Normaliza el código de departamento para comparar sin depender de espacios. */
const normalizeCode = normalizeText;

/**
 * Busca entre las cuotas candidatas la que corresponde a una descripción.
 * Primero exacta; si no hay, por contención en cualquier sentido, para que
 * "luz" encuentre "Cuota especial luz" sin obligar a transcribirla completa.
 */
function matchByDescription<T extends { description: string }>(
  candidates: T[],
  wanted: string
): T[] {
  const w = normalizeText(wanted).toLowerCase();
  const exact = candidates.filter((c) => normalizeText(c.description).toLowerCase() === w);
  if (exact.length > 0) return exact;
  return candidates.filter((c) => {
    const d = normalizeText(c.description).toLowerCase();
    return d.includes(w) || w.includes(d);
  });
}

/** Lista descripciones para un mensaje de error, sin repetir. */
function describeOptions(charges: { description: string }[]): string {
  return [...new Set(charges.map((c) => c.description))].map((d) => `"${d}"`).join(", ");
}

function parseCurrency(value: unknown): PaymentCurrency | "UNKNOWN" | null {
  const s = stripAccents(String(value ?? ""));
  if (!s) return null;
  if (/div|eur|efec|usd|dol|\$/.test(s)) return PaymentCurrency.DIVISAS;
  if (/bs|boliv|vef|ves/.test(s)) return PaymentCurrency.BS;
  return "UNKNOWN";
}

interface ParsedRow {
  line: number;
  codigo: string;
  fecha: string | null;
  fechaRaw: string;
  moneda: PaymentCurrency;
  monedaAsumida: boolean;
  monedaInvalida: string | null;
  monto: number | null;
  modalidad: string;
  modalidadInvalida: string | null;
  referencia: string;
  periodo: string | null;
  periodoRaw: string;
  descripcion: string;
}

function parseSheet(buffer: Buffer): ParsedRow[] {
  const read = readSheet(buffer, ["codigo", "depto", "departamento", "unidad"], "Pagos");

  const codeCol = findColumn(read.headers, ["codigo", "depto", "departamento", "unidad", "inmueble"]);
  if (!codeCol) {
    throw new Error(
      "No se encontró la columna 'codigo' en la planilla. Columnas leídas: " +
        read.headers.filter(Boolean).join(", ")
    );
  }
  const dateCol = findColumn(read.headers, ["fecha"]);
  const currencyCol = findColumn(read.headers, ["moneda", "divisa"]);
  const amountCol = findColumn(read.headers, ["monto", "importe", "cantidad", "valor"]);
  const bankCol = findColumn(read.headers, ["modalidad", "metodo", "forma"]);
  const refCol = findColumn(read.headers, ["referencia", "ref"]);
  const periodCol = findColumn(read.headers, ["periodo", "mes"]);
  const descCol = findColumn(read.headers, ["descripcion", "concepto", "detalle", "cuota"]);

  const idx = (col?: string) => (col ? read.headers.indexOf(col) : -1);
  const iCode = idx(codeCol);
  const iDate = idx(dateCol);
  const iCurrency = idx(currencyCol);
  const iAmount = idx(amountCol);
  const iBank = idx(bankCol);
  const iRef = idx(refCol);
  const iPeriod = idx(periodCol);
  const iDesc = idx(descCol);

  const cell = (row: unknown[], i: number) => (i >= 0 ? row[i] : undefined);

  return read.rows
    .map((row, n) => {
      const raw = read.rawRows[n] ?? [];
      const codigo = String(cell(row, iCode) ?? "").trim();

      const monedaParsed = parseCurrency(cell(row, iCurrency));
      // El valor crudo es exacto; el texto solo se usa si la celda no es numérica.
      const montoRaw = cell(raw, iAmount);
      const montoCell = typeof montoRaw === "number" ? montoRaw : cell(row, iAmount);
      const montoTexto = String(montoCell ?? "").trim();
      const monto = montoTexto ? parseAmount(montoCell) : null;

      const fechaRaw = String(cell(row, iDate) ?? "").trim();
      const periodoRaw = String(cell(row, iPeriod) ?? "").trim();
      const referencia = readReference(String(cell(row, iRef) ?? ""), cell(raw, iRef));
      const modalidadParsed = parseModalidad(cell(row, iBank));

      return {
        line: read.headerRowIdx + n + 2, // +1 por el encabezado, +1 porque Excel es 1-based
        codigo,
        fecha: parseDate(cell(raw, iDate) ?? cell(row, iDate)) ?? null,
        fechaRaw,
        moneda: monedaParsed === "UNKNOWN" || monedaParsed === null ? PaymentCurrency.BS : monedaParsed,
        monedaAsumida: monedaParsed === null,
        monedaInvalida:
          monedaParsed === "UNKNOWN" ? String(cell(row, iCurrency) ?? "").trim() : null,
        monto,
        // Sin modalidad se deduce de la referencia, como en el formulario:
        // con referencia es una transferencia; sin ella, efectivo.
        modalidad:
          modalidadParsed && modalidadParsed !== "UNKNOWN"
            ? modalidadParsed
            : referencia
            ? "Transferencia"
            : "Efectivo",
        modalidadInvalida:
          modalidadParsed === "UNKNOWN" ? String(cell(row, iBank) ?? "").trim() : null,
        referencia,
        periodo: parsePeriod(cell(raw, iPeriod) ?? cell(row, iPeriod)),
        periodoRaw,
        descripcion: String(cell(row, iDesc) ?? "").trim(),
      };
    })
    // Una fila sin código y sin monto es una fila vacía del Excel, no un error.
    .filter((r) => r.codigo !== "" || r.monto !== null || r.referencia !== "");
}

/* ------------------------------------------------------------------ */
/*  Simulación (vista previa)                                          */
/* ------------------------------------------------------------------ */

interface SimCharge extends ChargeLike {
  id: string;
  period: string;
  description: string;
  dueDate: string;
  amount: number;
  moraAmount: number;
  amountPaid: number;
  status: ChargeStatus;
  currency: RateCurrency;
  ownerId: string | null;
  propertyId: string;
}

/**
 * Orden de cobro: vencimiento, y a igualdad, período y descripción. Los
 * desempates importan: con varias cuotas del mismo mes (luz, agua,
 * mantenimiento) un orden indefinido haría que la vista previa y la carga real
 * eligieran cuotas distintas. El mismo criterio va en las consultas a la base.
 */
const byDueDate = (a: SimCharge, b: SimCharge) =>
  a.dueDate < b.dueDate
    ? -1
    : a.dueDate > b.dueDate
    ? 1
    : a.period.localeCompare(b.period) || a.description.localeCompare(b.description);

export const PaymentImportService = {
  /**
   * Recorre la planilla sin escribir nada y devuelve, fila por fila, qué cuota
   * saldaría, qué cuotas cerraría en cascada y si el extracto ya cargado la
   * confirmaría sola. La simulación asume que todas las filas se confirman:
   * así el admin ve el estado final al que apunta el archivo completo.
   */
  async preview(buffer: Buffer): Promise<ImportPreview> {
    const parsed = parseSheet(buffer);

    const properties = await AppDataSource.getRepository(Property).find({
      relations: { owner: true },
    });
    const propByCode = new Map<string, Property>();
    for (const p of properties) propByCode.set(normalizeCode(p.code), p);

    const charges = await AppDataSource.getRepository(Charge).find({
      relations: { property: { owner: true } },
    });

    // Estado mutable en memoria: nunca se guarda.
    const sim: SimCharge[] = charges.map((c) => ({
      id: c.id,
      period: c.period,
      description: c.description ?? "",
      dueDate: String(c.dueDate),
      amount: Number(c.amount),
      moraAmount: Number(c.moraAmount ?? 0),
      amountPaid: Number(c.amountPaid ?? 0),
      status: c.status,
      currency: chargeRateCurrency(c),
      ownerId: c.property?.owner?.id ?? null,
      propertyId: c.property?.id ?? "",
    }));
    const byProperty = new Map<string, SimCharge[]>();
    const byOwner = new Map<string, SimCharge[]>();
    for (const s of sim) {
      if (!byProperty.has(s.propertyId)) byProperty.set(s.propertyId, []);
      byProperty.get(s.propertyId)!.push(s);
      if (s.ownerId) {
        if (!byOwner.has(s.ownerId)) byOwner.set(s.ownerId, []);
        byOwner.get(s.ownerId)!.push(s);
      }
    }
    for (const list of byProperty.values()) list.sort(byDueDate);
    for (const list of byOwner.values()) list.sort(byDueDate);

    // Referencias ya registradas: un pago con la misma referencia sería rechazado.
    const existingRefs = new Set(
      (
        await AppDataSource.getRepository(Payment).find({
          select: { reference: true, status: true },
        })
      )
        .filter((p) => p.status !== PaymentStatus.REJECTED && p.reference)
        .map((p) => normalizeRef(p.reference))
    );

    const freeEntries = await AppDataSource.getRepository(BankEntry).findBy({ matched: false });
    const usedEntries = new Set<string>();

    const { primary } = await getRateConfig();
    const rateCache = new Map<string, number>();
    const rateFor = async (date: string, currency: RateCurrency): Promise<number> => {
      const key = `${date}|${currency}`;
      if (!rateCache.has(key)) rateCache.set(key, (await getRateForDate(date, currency)).rate);
      return rateCache.get(key)!;
    };

    const seenRefs = new Set<string>();
    // Cuotas que quedan saldadas, por id: dos filas pueden cerrar entre ambas
    // una misma cuota, y eso es UNA cuota saldada, no dos.
    const settledCharges = new Set<string>();
    const rows: ImportPreviewRow[] = [];

    for (const r of parsed) {
      const out: ImportPreviewRow = {
        line: r.line,
        codigo: r.codigo,
        ownerName: null,
        paymentDate: r.fecha,
        currency: r.moneda,
        currencyAssumed: r.monedaAsumida,
        reference: r.referencia,
        modalidad: r.modalidad,
        amountBs: null,
        amountEur: null,
        targetPeriod: null,
        targetDescription: null,
        targetSettled: false,
        periodExplicit: r.periodo !== null,
        cascade: [],
        creditLeft: 0,
        willAutoConfirm: false,
        errors: [],
        warnings: [],
      };

      // --- Validaciones de forma ---
      if (!r.codigo) out.errors.push("Falta el código del departamento");
      if (!r.fecha) {
        out.errors.push(
          r.fechaRaw ? `Fecha no reconocida: "${r.fechaRaw}"` : "Falta la fecha del pago"
        );
      }
      if (r.monedaInvalida) {
        out.errors.push(`Moneda no reconocida: "${r.monedaInvalida}" (usa BS o DIVISAS)`);
      }
      if (r.monedaAsumida) out.warnings.push("Sin moneda: se asume Bs");
      if (r.modalidadInvalida) {
        out.errors.push(
          `Modalidad no reconocida: "${r.modalidadInvalida}" (solo ${MODALIDADES.join(" o ")})`
        );
      }
      if (r.periodoRaw && r.periodo === null) {
        out.errors.push(`Período no reconocido: "${r.periodoRaw}" (usa 2026-07)`);
      }
      if (r.monto !== null && (isNaN(r.monto) || r.monto <= 0)) {
        out.errors.push("El monto debe ser mayor que cero");
      }

      const ref = normalizeRef(r.referencia);
      if (ref) {
        if (seenRefs.has(ref)) out.errors.push("Referencia repetida dentro de la planilla");
        else if (existingRefs.has(ref)) out.errors.push("Ya existe un pago con esa referencia");
        seenRefs.add(ref);
      }

      // --- Resolución del departamento ---
      const property = r.codigo ? propByCode.get(normalizeCode(r.codigo)) : undefined;
      if (r.codigo && !property) out.errors.push("Departamento no encontrado en el padrón");
      if (property) {
        out.ownerName = property.owner?.fullName ?? null;
        if (!property.owner) out.errors.push("El departamento no tiene titular asignado");
      }

      if (out.errors.length > 0 || !property || !r.fecha) {
        rows.push(out);
        continue;
      }

      // --- Cuota destino ---
      const propCharges = byProperty.get(property.id) ?? [];
      const isOpen = (c: SimCharge) =>
        c.status === ChargeStatus.PENDING || c.status === ChargeStatus.PARTIAL;
      let target: SimCharge | undefined;

      if (r.periodo || r.descripcion) {
        // Se filtra por lo que la fila especifique. Un mismo período puede
        // tener varias cuotas (la de asociación y las especiales de luz, agua,
        // mantenimiento), así que la descripción es lo que las distingue.
        let candidates = r.periodo
          ? propCharges.filter((c) => c.period === r.periodo)
          : propCharges.filter(isOpen);

        if (candidates.length === 0) {
          out.errors.push(
            r.periodo
              ? `El departamento no tiene cuota del período ${r.periodo}`
              : "El departamento no tiene cuotas pendientes"
          );
        } else if (r.descripcion) {
          const matched = matchByDescription(candidates, r.descripcion);
          if (matched.length === 0) {
            out.errors.push(
              `No hay cuota "${r.descripcion}"${r.periodo ? ` en ${r.periodo}` : ""}. ` +
                `Disponibles: ${describeOptions(candidates)}`
            );
          } else if (matched.length > 1) {
            out.errors.push(
              `"${r.descripcion}" coincide con varias cuotas: ${describeOptions(matched)}`
            );
          } else {
            target = matched[0];
          }
        } else if (candidates.length > 1) {
          // Con período pero sin descripción y varias cuotas, elegir una sería
          // adivinar: mejor decir cuáles hay y que la planilla lo aclare.
          const open = candidates.filter(isOpen);
          if (open.length === 1) {
            target = open[0];
          } else {
            out.errors.push(
              `${r.periodo} tiene ${candidates.length} cuotas (${describeOptions(candidates)}). ` +
                "Indica cuál en la columna descripcion"
            );
          }
        } else {
          target = candidates[0];
        }

        if (target && target.status === ChargeStatus.PAID) {
          out.errors.push(`La cuota "${target.description}" (${target.period}) ya está pagada`);
          target = undefined;
        } else if (target && target.status === ChargeStatus.EXONERATED) {
          out.errors.push(`La cuota "${target.description}" (${target.period}) está exonerada`);
          target = undefined;
        }
      } else {
        target = propCharges.find(isOpen);
        if (!target) out.errors.push("El departamento no tiene cuotas pendientes");
      }

      if (out.errors.length > 0 || !target) {
        rows.push(out);
        continue;
      }
      out.targetPeriod = target.period;
      out.targetDescription = target.description;

      // --- Monto en divisas ---
      let eur: number;
      if (r.moneda === PaymentCurrency.BS) {
        const rate = await rateFor(r.fecha, target.currency);
        if (r.monto !== null) {
          out.amountBs = Math.round(r.monto * 100) / 100;
          eur = Math.round((out.amountBs / rate) * 100) / 100;
        } else {
          eur = amountDue(target as unknown as Charge, PaymentCurrency.BS, r.fecha);
          out.amountBs = Math.round(eur * rate * 100) / 100;
          out.warnings.push("Sin monto: se toma la deuda completa de la cuota");
        }
      } else {
        if (r.monto !== null) {
          eur = Math.round(r.monto * 100) / 100;
        } else {
          eur = amountDue(target as unknown as Charge, PaymentCurrency.DIVISAS, r.fecha);
          out.warnings.push("Sin monto: se toma la deuda completa de la cuota");
        }
      }
      out.amountEur = eur;

      if (eur <= 0) {
        out.errors.push("El monto en divisas queda en cero");
        rows.push(out);
        continue;
      }

      // --- Aplicación sobre la cuota y cascada del excedente ---
      // Misma aritmética que la confirmación real (`allocatePayment`).
      const others = (property.owner ? byOwner.get(property.owner.id) : undefined) ?? [];
      const rates: Partial<Record<RateCurrency, number>> = {};
      if (r.moneda === PaymentCurrency.BS) {
        const open = others.filter(
          (c) => c.status === ChargeStatus.PENDING || c.status === ChargeStatus.PARTIAL
        );
        for (const cur of new Set([primary, target.currency, ...open.map((c) => c.currency)])) {
          rates[cur] = await rateFor(r.fecha, cur);
        }
      }
      const { steps, credit } = allocatePayment(
        [target],
        others,
        { currency: r.moneda, amount: eur, amountBs: out.amountBs, paymentDate: r.fecha },
        rates,
        primary
      );
      for (const { charge, app } of steps) {
        if (charge.status === ChargeStatus.EXONERATED) continue;
        charge.amountPaid = app.amountPaid;
        charge.status = app.status;
        if (charge === target) {
          out.targetSettled = app.status === ChargeStatus.PAID;
          if (out.targetSettled) settledCharges.add(target.id);
        } else if (app.status === ChargeStatus.PAID) {
          out.cascade.push({ period: charge.period, description: charge.description });
          settledCharges.add(charge.id);
        }
      }
      out.creditLeft = property.owner ? credit : 0;

      // --- ¿La confirmará sola el extracto ya cargado? ---
      if (ref.length >= MIN_SUFFIX) {
        const entry = freeEntries.find(
          (e) => !usedEntries.has(e.id) && refsMatch(e.referencia, r.referencia)
        );
        if (
          entry &&
          amountMatchesBankEntry(
            { currency: r.moneda, amountBs: out.amountBs, amount: eur } as Payment,
            Number(entry.monto)
          )
        ) {
          out.willAutoConfirm = true;
          usedEntries.add(entry.id);
        } else if (entry) {
          out.warnings.push(
            `La referencia está en el extracto por Bs. ${Number(entry.monto).toLocaleString("es-VE")} — quedará pendiente`
          );
        }
      }

      rows.push(out);
    }

    const valid = rows.filter((r) => r.errors.length === 0);
    return {
      rows,
      totalRows: rows.length,
      validRows: valid.length,
      errorRows: rows.length - valid.length,
      totalEur: Math.round(valid.reduce((s, r) => s + (r.amountEur ?? 0), 0) * 100) / 100,
      willConfirm: valid.filter((r) => r.willAutoConfirm).length,
      chargesSettled: settledCharges.size,
    };
  },

  /**
   * Crea de verdad los pagos de las filas válidas. Cada uno pasa por
   * `PaymentService.create`, así que hereda las validaciones, la tasa del día
   * y el auto-confirmado contra el extracto. Las filas con error se omiten y se
   * reportan: una planilla de 200 líneas no debe caerse entera por dos errores.
   */
  async commit(buffer: Buffer): Promise<ImportResult> {
    const preview = await this.preview(buffer);
    const parsed = parseSheet(buffer);
    const byLine = new Map(parsed.map((p) => [p.line, p]));

    const chargeRepo = AppDataSource.getRepository(Charge);

    // El padrón admite códigos con espaciado distinto al de la planilla, así que
    // se resuelve por comparación normalizada, igual que en la vista previa.
    const properties = await AppDataSource.getRepository(Property).find({
      relations: { owner: true },
    });
    const propByCode = new Map(properties.map((p) => [normalizeCode(p.code), p]));

    const result: ImportResult = { created: 0, confirmed: 0, failed: [] };

    for (const row of preview.rows) {
      if (row.errors.length > 0) {
        result.failed.push({ line: row.line, codigo: row.codigo, error: row.errors[0]! });
        continue;
      }
      const src = byLine.get(row.line);
      if (!src || !src.fecha) continue;

      try {
        const prop = propByCode.get(normalizeCode(row.codigo));
        if (!prop?.owner) throw new Error("Departamento sin titular");

        // Se cobra la cuota exacta que resolvió la vista previa, no una nueva
        // búsqueda: si se volviera a resolver aquí, una fila anterior que no
        // llegó a confirmarse dejaría la cuota abierta y esta fila podría caer
        // en otra distinta de la que se te mostró. Si entretanto quedó pagada,
        // `create` lo rechaza y la fila se reporta — visible, no silencioso.
        if (!row.targetPeriod) throw new Error("Sin cuota pendiente donde imputar el pago");

        const candidatas = await chargeRepo.find({
          where: {
            property: { id: prop.id },
            period: row.targetPeriod,
            ...(row.targetDescription ? { description: row.targetDescription } : {}),
          },
          order: { dueDate: "ASC", period: "ASC", description: "ASC" },
        });
        const charge =
          candidatas.find(
            (c) => c.status === ChargeStatus.PENDING || c.status === ChargeStatus.PARTIAL
          ) ?? candidatas[0];
        if (!charge) throw new Error("Sin cuota pendiente donde imputar el pago");

        const created = await PaymentService.create(prop.owner.id, {
          chargeId: charge.id,
          currency: src.moneda,
          bank: src.modalidad,
          reference: src.referencia,
          paymentDate: src.fecha,
          // Solo se manda el monto cuando la planilla lo trae. Si viene vacío,
          // `create` calcula la deuda exacta de la cuota y así no queda un
          // céntimo colgando por redondear divisas → Bs → divisas.
          ...(src.monto !== null && src.moneda === PaymentCurrency.BS
            ? { amountBs: Math.round(src.monto * 100) / 100 }
            : {}),
          ...(src.monto !== null && src.moneda === PaymentCurrency.DIVISAS
            ? { amountEur: Math.round(src.monto * 100) / 100 }
            : {}),
        });

        result.created++;
        if (created.status === PaymentStatus.CONFIRMED) result.confirmed++;
      } catch (err) {
        result.failed.push({
          line: row.line,
          codigo: row.codigo,
          error: err instanceof Error ? err.message : "Error desconocido",
        });
      }
    }

    return result;
  },

  /**
   * Plantilla .xlsx con tres hojas: la que se llena, las instrucciones y el
   * padrón con la deuda al día para copiar los códigos sin equivocarse.
   */
  async buildTemplate(): Promise<Buffer> {
    const wb = XLSX.utils.book_new();

    // --- Hoja 1: la que se llena (solo encabezados) ---
    const pagos = XLSX.utils.aoa_to_sheet([[...TEMPLATE_HEADERS]]);

    // Excel convierte una referencia larga a notación científica y se come los
    // ceros a la izquierda en cuanto decide que la celda es un número. Se dejan
    // las celdas de esa columna preformateadas como Texto para que no lo haga:
    // al escribir encima, Excel conserva el formato que ya tenía la celda.
    const REF_COL = TEMPLATE_HEADERS.indexOf("referencia");
    const PREFORMATTED_ROWS = 500;
    for (let r = 1; r <= PREFORMATTED_ROWS; r++) {
      pagos[XLSX.utils.encode_cell({ c: REF_COL, r })] = { t: "s", v: "", z: "@" };
    }
    pagos["!ref"] = XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: TEMPLATE_HEADERS.length - 1, r: PREFORMATTED_ROWS },
    });

    pagos["!cols"] = [
      { wch: 16 }, // codigo
      { wch: 12 }, // fecha
      { wch: 10 }, // moneda
      { wch: 14 }, // monto
      { wch: 16 }, // modalidad
      { wch: 20 }, // referencia
      { wch: 10 }, // periodo
      { wch: 24 }, // descripcion
    ];
    XLSX.utils.book_append_sheet(wb, pagos, "Pagos");

    // --- Hoja 2: instrucciones ---
    const instrucciones = XLSX.utils.aoa_to_sheet([
      ["Carga de pagos en lote — cómo llenar la hoja \"Pagos\""],
      [],
      ["Columna", "¿Obligatoria?", "Qué poner"],
      ["codigo", "Sí", "Código del departamento tal como aparece en el padrón (hoja \"Unidades\")."],
      ["fecha", "Sí", "Fecha del pago: 2026-07-08 o 08/07/2026. Define la tasa BCV y si aplica mora."],
      ["moneda", "No", "BS o DIVISAS. Si se deja vacío se asume BS."],
      ["monto", "No", "En Bs si moneda es BS; en $ si es DIVISAS. Vacío = se cobra la cuota completa."],
      [
        "modalidad",
        "No",
        "Solo Efectivo o Transferencia (los mismos valores del formulario de pago; no es el nombre del banco). Vacío: Transferencia si hay referencia, Efectivo si no.",
      ],
      [
        "referencia",
        "No",
        "Referencia bancaria. Vacío = efectivo. Debe ser única. Si empieza por cero, formatea la columna como Texto para no perderlo.",
      ],
      ["periodo", "No", "2026-07 para imputar a un mes concreto. Vacío = la cuota pendiente más antigua."],
      [
        "descripcion",
        "Si el mes tiene varias cuotas",
        "Distingue entre las cuotas de un mismo período (ej. Luz, Agua, Mantenimiento). Basta una palabra que las diferencie. Ver la hoja \"Cuotas\".",
      ],
      [],
      ["Ejemplos"],
      [...TEMPLATE_HEADERS],
      ["DEP1 N-11", "2026-07-08", "BS", 4500, "Transferencia", "0012345678", "", ""],
      ["DEP1 N-11", "2026-07-08", "DIVISAS", 25, "Efectivo", "", "2026-07", ""],
      ["DEP1 N-11", "2026-07-08", "BS", 1800, "Transferencia", "0012345679", "2026-07", "Luz"],
      [],
      ["Cómo se asocia el pago con la deuda"],
      ["1. Si escribes un período, el pago se imputa a esa cuota."],
      ["1b. Si ese mes tiene varias cuotas, hay que indicar además la descripción; si no, la fila se marca con error y te dice cuáles hay."],
      ["2. Si dejas período y descripción vacíos, va a la cuota pendiente más antigua del departamento."],
      ["3. Si el monto supera esa cuota, el excedente cierra las siguientes en orden de vencimiento."],
      ["4. Lo que sobre al final queda como saldo a favor del titular."],
      ["5. Si la referencia ya está en el extracto y el monto cuadra, el pago se confirma solo."],
      [],
      ["Antes de importar verás una vista previa fila por fila. Nada se guarda hasta que la confirmes."],
    ]);
    instrucciones["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 95 }];
    XLSX.utils.book_append_sheet(wb, instrucciones, "Instrucciones");

    // --- Hoja 3: padrón con deuda al día ---
    const properties = await AppDataSource.getRepository(Property).find({
      relations: { owner: true, tower: true },
      order: { code: "ASC" },
    });
    const charges = await AppDataSource.getRepository(Charge).find({
      relations: { property: true },
    });

    const pendingByProp = new Map<string, Charge[]>();
    for (const c of charges) {
      if (c.status !== ChargeStatus.PENDING && c.status !== ChargeStatus.PARTIAL) continue;
      const key = c.property?.id;
      if (!key) continue;
      if (!pendingByProp.has(key)) pendingByProp.set(key, []);
      pendingByProp.get(key)!.push(c);
    }

    const unidades = XLSX.utils.aoa_to_sheet([
      ["codigo", "torre", "titular", "cedula", "cuotas pendientes", "deuda REF", "cuota mas antigua"],
      ...properties.map((p) => {
        const pend = (pendingByProp.get(p.id) ?? []).sort((a, b) =>
          String(a.dueDate) < String(b.dueDate) ? -1 : 1
        );
        const deuda = pend.reduce((s, c) => s + amountDue(c), 0);
        return [
          p.code,
          p.tower?.name ?? "",
          p.owner?.fullName ?? "",
          p.owner?.cedula ?? "",
          pend.length,
          Math.round(deuda * 100) / 100,
          pend[0]?.period ?? "",
        ];
      }),
    ]);
    unidades["!cols"] = [
      { wch: 16 }, { wch: 14 }, { wch: 28 }, { wch: 14 },
      { wch: 18 }, { wch: 12 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, unidades, "Unidades");

    // --- Hoja 4: cuotas pendientes, para copiar período y descripción exactos ---
    const pendientes = [...pendingByProp.entries()]
      .flatMap(([, list]) => list)
      .sort(
        (a, b) =>
          (a.property?.code ?? "").localeCompare(b.property?.code ?? "") ||
          a.period.localeCompare(b.period) ||
          a.description.localeCompare(b.description)
      );

    const cuotas = XLSX.utils.aoa_to_sheet([
      ["codigo", "periodo", "descripcion", "tipo", "vence", "deuda REF", "tasa", "estado"],
      ...pendientes.map((c) => [
        c.property?.code ?? "",
        c.period,
        c.description,
        c.type,
        String(c.dueDate),
        Math.round(amountDue(c) * 100) / 100,
        c.currency ?? "EUR",
        c.status,
      ]),
    ]);
    cuotas["!cols"] = [
      { wch: 16 }, { wch: 10 }, { wch: 34 }, { wch: 10 },
      { wch: 12 }, { wch: 11 }, { wch: 6 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, cuotas, "Cuotas");

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  },
};
