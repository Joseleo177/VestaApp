/** Formateadores reutilizables de moneda y fechas. */

const currencyFmt = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "EUR",
});

export function formatCurrency(value: number | string): string {
  return currencyFmt.format(Number(value));
}

const bsFmt = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Convierte un monto USD a bolívares usando la tasa dada. */
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
