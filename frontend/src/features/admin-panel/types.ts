import { Property } from "@/types/domain";

/** Propiedad con su saldo pendiente, para el control de morosidad. */
export interface PropertyWithBalance extends Property {
  balance: number;
}

export type DelinquencyFilter = "ALL" | "CURRENT" | "DELINQUENT";
