export interface UnitInput {
  code: string;
  towerId?: string;
  ownerId: string;
  /** Autorizado de la unidad. Cadena vacía = sin autorizado. */
  authorizedId?: string;
}
