const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Quita acentos y pasa a minúsculas para que "aguero" encuentre a "Agüero"
 * y "farina" a "Fariña". El padrón está lleno de ñ y diéresis.
 */
export const normalize = (value: string) =>
  value.normalize("NFD").replace(DIACRITICOS, "").toLowerCase();

/**
 * ¿Alguno de los campos contiene el término? Ignora acentos y mayúsculas,
 * y descarta los campos vacíos. Con término vacío devuelve true.
 */
export function matchesTerm(term: string, fields: (string | null | undefined)[]) {
  const needle = normalize(term.trim());
  if (!needle) return true;
  return fields.some((field) => field && normalize(field).includes(needle));
}