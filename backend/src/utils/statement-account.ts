/**
 * Detecta de qué cuenta es un extracto leyendo el número de cuenta que trae el
 * propio archivo, esté en la celda que esté. Así no depende de que se elija
 * bien la pestaña "Cuenta en Bs / Cuenta en $" al subirlo.
 */

/** Solo los dígitos: "0174-0142-49 1424537189" → "01740142491424537189". */
export const digitsOf = (s: string) => s.replace(/\D/g, "");

/** Menos dígitos que esto no es un número de cuenta (p. ej. un correo de Zelle). */
export const MIN_ACCOUNT_DIGITS = 10;
/** Terminación mínima visible en una cuenta enmascarada ("****1234"). */
const MIN_TAIL_DIGITS = 4;

export type AccountMatch<K extends string> = { key: K; by: "full" | "tail" };

/**
 * `texts`: el texto de cada celda, en orden de lectura (hoja por hoja, fila por
 * fila), más lo que se quiera sumar, como el nombre del archivo.
 * `accounts`: número de cuenta configurado por clave (BS, USD…).
 *
 * - Cuenta completa: gana la primera que aparece. El titular suele estar arriba,
 *   y una cuenta ajena puede salir después en la descripción de una transferencia.
 * - Cuenta enmascarada ("0102-****-**-******1234"): solo si su terminación
 *   corresponde a una sola de las cuentas.
 */
export function detectStatementAccount<K extends string>(
  texts: Iterable<string>,
  accounts: Partial<Record<K, string>>
): AccountMatch<K> | null {
  const configured = (Object.entries(accounts) as [K, string | undefined][])
    .map(([key, value]) => ({ key, digits: digitsOf(value ?? "") }))
    .filter((a) => a.digits.length >= MIN_ACCOUNT_DIGITS);
  // Dos claves con el mismo número no permiten distinguir nada.
  const usable = configured.filter(
    (a) => configured.filter((b) => b.digits === a.digits).length === 1
  );
  if (usable.length === 0) return null;

  const tailHits = new Set<K>();
  // La máscara no puede ir pegada a una palabra ("EXXON 1234" no es una cuenta).
  const masked = /(?<![A-Za-z])[*xX•#]{2,}[\s\-.]*(\d{4,})/g;

  for (const text of texts) {
    if (!text) continue;
    const digits = digitsOf(text);
    if (digits.length >= MIN_ACCOUNT_DIGITS) {
      const full = usable.find((a) => digits.includes(a.digits));
      if (full) return { key: full.key, by: "full" };
    }
    for (const m of text.matchAll(masked)) {
      const tail = m[1]!;
      if (tail.length < MIN_TAIL_DIGITS) continue;
      const owners = usable.filter((a) => a.digits.endsWith(tail));
      if (owners.length === 1) tailHits.add(owners[0]!.key);
    }
  }

  if (tailHits.size === 1) return { key: [...tailHits][0]!, by: "tail" };
  return null;
}
