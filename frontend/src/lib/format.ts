/** Formateadores reutilizables de moneda y fechas. */

// Los montos en divisas llevan el símbolo de la moneda con cuya tasa se cobran:
// "€ 40,00" si la cuota va a tasa euro, "$ 40,00" si va a tasa dólar (y "$" si
// el pago se hizo en dólares). Lo que no es de una cuota concreta (totales que
// suman varias, saldo a favor) va con la moneda principal, la misma con que se
// valora el saldo a favor. Los bolívares llevan "Bs.".
const refFmt = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PRIMARY_KEY = "condo.primaryCurrency";

/** Moneda principal (ajuste del admin). Se recuerda para no esperar a la API. */
let primaryCurrency: string = (() => {
  try {
    return localStorage.getItem(PRIMARY_KEY) || "EUR";
  } catch {
    return "EUR";
  }
})();

/** La fija el proveedor de tasas al cargarlas. */
export function setPrimaryCurrency(currency: string | null | undefined): void {
  if (!currency || currency === primaryCurrency) return;
  primaryCurrency = currency;
  try {
    localStorage.setItem(PRIMARY_KEY, currency);
  } catch {
    // Sin almacenamiento: vale para esta sesión.
  }
}

/** "€" o "$". */
export function currencySymbol(currency?: string | null): string {
  return (currency ?? primaryCurrency) === "USD" ? "$" : "€";
}

/**
 * Monto en divisas con su símbolo. `currency` es la moneda de la cuota (USD/EUR);
 * sin ella, la principal.
 */
export function formatCurrency(value: number | string, currency?: string | null): string {
  const n = Number(value);
  return `${n < 0 ? "-" : ""}${currencySymbol(currency)} ${refFmt.format(Math.abs(n))}`;
}

/**
 * Moneda de una suma de cuotas: la de todas si comparten tasa; si mezclan (o no
 * hay ninguna), null, y el monto va con la principal.
 */
export function commonCurrency(items: { currency?: string | null }[]): string | null {
  const set = new Set(items.map((i) => i.currency ?? null));
  return set.size === 1 ? [...set][0] : null;
}

/**
 * Moneda de un pago: "$" si se pagó en dólares (efectivo o transferencia); si
 * fue en Bs, la de la tasa con que se convirtió.
 */
export function paymentCurrencyOf(p: {
  currency?: string | null;
  rateCurrency?: string | null;
  fromCredit?: boolean | null;
}): string | null {
  // Con saldo a favor no se entregaron dólares: va en la moneda de la cuota (o la principal).
  if (p.fromCredit) return p.rateCurrency ?? null;
  return p.currency === "DIVISAS" ? "USD" : p.rateCurrency ?? null;
}

const bsFmt = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Convierte un monto en divisas a bolívares usando la tasa dada. */
export function formatBs(usd: number | string, rate: number): string {
  return `Bs. ${bsFmt.format(Number(usd) * rate)}`;
}

/** Formatea la tasa de cambio (ej. "622,2135"). */
export function formatRate(rate: number): string {
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate);
}

export function formatDate(value: string | Date): string {
  let date: Date;
  if (typeof value === "string") {
    // YYYY-MM-DD sin hora: parsear como hora local para evitar desfase UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      date = new Date(y, (m ?? 1) - 1, d ?? 1);
    } else {
      date = new Date(value);
    }
  } else {
    date = value;
  }
  return date.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "2026-06" -> "Junio 2026" */
export function formatPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, 1);
  const label = date.toLocaleDateString("es-VE", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** ¿La fecha límite ya pasó? */
export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate).getTime() < new Date().setHours(0, 0, 0, 0);
}

/** Etiqueta corta de la tasa BCV con que se cobra una cuota en Bs. */
export function rateLabel(currency: string | null | undefined): string {
  return currency === "USD" ? "Bs a tasa $" : "Bs a tasa €";
}

/** "Bs/USD" o "Bs/EUR". */
export function rateUnit(currency: string | null | undefined): string {
  return currency === "USD" ? "Bs/USD" : "Bs/EUR";
}

/**
 * Documento tal como se muestra: "V-9.613.328", o "J-50440139-0" para un RIF
 * de 9 dígitos. La cédula se guarda solo en dígitos; la letra va aparte.
 */
export function formatDocumentId(tipo: string | null | undefined, cedula: string | null | undefined): string {
  if (!cedula) return "—";
  const digits = cedula.replace(/\D/g, "");
  if (!digits || digits !== cedula) return cedula;
  const t = tipo || "V";
  if ((t === "J" || t === "G") && digits.length === 9) return `${t}-${digits.slice(0, 8)}-${digits.slice(8)}`;
  return `${t}-${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}
