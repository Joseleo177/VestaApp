import { DocumentType, User, UserRole } from "@/types/domain";
import { PropertyWithBalance } from "@/features/admin-panel/types";

export interface CreateUserInput {
  cedula: string;
  cedulaTipo?: DocumentType;
  password: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: UserRole;
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, "password">> & {
  password?: string;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: "Administrador",
  [UserRole.OWNER]: "Copropietario",
  [UserRole.AUTHORIZED]: "Autorizado",
};

/** Saldo a favor de un titular y sus últimos ajustes manuales. */
export interface CreditInfo {
  creditBalance: number;
  adjustments: {
    id: string;
    /** Lo que sumó (positivo) o quitó (negativo). */
    amount: number;
    balanceAfter: number;
    reason: string;
    createdBy: string | null;
    createdAt: string;
  }[];
}

/** Saldos por debajo de esto son redondeo, no deuda. */
export const DEBT_EPSILON = 0.005;

/** Qué es el cliente de un departamento. */
export type UnitRelation = "OWNER" | "AUTHORIZED" | "BOTH";

export const RELATION_LABELS: Record<UnitRelation, string> = {
  OWNER: "Titular",
  AUTHORIZED: "Autorizado",
  BOTH: "Titular y autorizado",
};

export interface ClientUnit {
  property: PropertyWithBalance;
  relation: UnitRelation;
}

/**
 * Usuario visto como cliente: con los departamentos que tiene (como titular o
 * autorizado) y lo que esos departamentos deben.
 */
export interface Client extends User {
  units: ClientUnit[];
  /** Suma de saldos pendientes de sus departamentos, en divisas. */
  debt: number;
  unitsWithDebt: number;
}

export type RoleFilter = "ALL" | UserRole;
export type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
export type ClientSort = "NAME" | "DEBT";

/** `isActive` ausente es un usuario de antes de que existiera el campo: activo. */
export const isActiveClient = (u: User) => u.isActive !== false;
