import clsx, { type ClassValue } from "clsx";

/** Helper para componer clases de Tailwind condicionalmente. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
