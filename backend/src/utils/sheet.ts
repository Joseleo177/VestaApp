import * as XLSX from "xlsx";

/**
 * Utilidades compartidas para leer hojas de cálculo subidas por el admin
 * (extracto bancario, planilla de pagos en lote). Los bancos y los Excel
 * hechos a mano traen formatos de fecha y monto muy variados, así que el
 * parseo tolerante vive aquí una sola vez.
 */

/** Quita tildes y pasa a minúsculas para comparar encabezados. */
export function stripAccents(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Convierte cualquier formato de fecha a YYYY-MM-DD. */
export function parseDate(value: unknown): string | undefined {
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

  // DD/MM/YYYY o D/M/YYYY o D/M/YY (también con guiones)
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1]!.padStart(2, "0");
    const month = dmy[2]!.padStart(2, "0");
    let year = dmy[3]!;
    if (year.length === 2) year = `20${year}`;
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

/**
 * Monto en valor absoluto. Distingue "1.234,56" (es) de "1,234.56" (en) por
 * cuál separador aparece de último.
 */
export function parseAmount(value: unknown): number {
  if (typeof value === "number") return Math.abs(value);
  const str = String(value ?? "").trim();
  const clean = str.replace(/[^\d,.-]/g, "");
  if (!clean) return 0;
  if (clean.includes(",") && clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
    return Math.abs(parseFloat(clean.replace(/\./g, "").replace(",", ".")));
  }
  return Math.abs(parseFloat(clean.replace(/,/g, "")));
}

/**
 * Busca el primer encabezado que contenga alguno de los patrones, en el orden
 * dado (el orden define la prioridad). Devuelve el encabezado original.
 */
export function findColumn(headers: string[], patterns: string[]): string | undefined {
  const norm = headers.map(stripAccents);
  for (const pat of patterns) {
    const idx = norm.findIndex((h) => h.includes(pat));
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

export interface SheetRead {
  headers: string[];
  /** Filas como texto formateado (preserva ceros a la izquierda). */
  rows: unknown[][];
  /** Mismas filas con valores nativos (Date real en celdas de fecha). */
  rawRows: unknown[][];
  /** Índice 0-based de la fila de encabezados, para numerar filas en los errores. */
  headerRowIdx: number;
}

/**
 * Lee la primera hoja de un .xlsx dos veces: como texto (para no perder ceros
 * a la izquierda en las referencias) y en crudo (para obtener Date reales sin
 * depender del locale del servidor). Salta las filas de metadata previas al
 * encabezado buscando la primera que contenga alguna de las pistas.
 */
export function readSheet(buffer: Buffer, headerHints: string[], sheetName?: string): SheetRead {
  const wbText = XLSX.read(buffer, { type: "buffer", cellText: true, cellDates: false });
  const wbDates = XLSX.read(buffer, { type: "buffer", cellText: false, cellDates: true });

  const pick = (wb: XLSX.WorkBook) => {
    const name =
      (sheetName && wb.SheetNames.find((n) => stripAccents(n) === stripAccents(sheetName))) ||
      wb.SheetNames[0]!;
    return wb.Sheets[name]!;
  };

  const allRows: unknown[][] = XLSX.utils.sheet_to_json(pick(wbText), {
    header: 1,
    defval: "",
    raw: false,
  });
  const allRowsRaw: unknown[][] = XLSX.utils.sheet_to_json(pick(wbDates), {
    header: 1,
    defval: "",
    raw: true,
  });

  if (allRows.length === 0) throw new Error("El archivo está vacío");

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(8, allRows.length); i++) {
    const row = (allRows[i] ?? []) as string[];
    if (row.some((cell) => headerHints.some((h) => stripAccents(String(cell)).includes(h)))) {
      headerRowIdx = i;
      break;
    }
  }

  return {
    headers: ((allRows[headerRowIdx] ?? []) as string[]).map(String),
    rows: allRows.slice(headerRowIdx + 1),
    rawRows: allRowsRaw.slice(headerRowIdx + 1),
    headerRowIdx,
  };
}
