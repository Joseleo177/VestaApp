/**
 * Enlace de WhatsApp para un teléfono venezolano tal como lo escriben en el
 * padrón ("0414-1234567", "+58 414 1234567", "4141234567"). Devuelve null si el
 * número no tiene forma de celular completo.
 */
export function whatsappUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("58") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  return `https://wa.me/58${digits}`;
}
