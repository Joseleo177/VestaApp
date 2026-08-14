export enum UserRole {
  ADMIN = "ADMIN",
  OWNER = "OWNER",
  /** Autorizado de uno o más departamentos (un OWNER también puede serlo). */
  AUTHORIZED = "AUTHORIZED",
}

/** Roles que acceden al panel de residente (titular o autorizado). */
export const RESIDENT_ROLES = [UserRole.OWNER, UserRole.AUTHORIZED] as const;

export enum PaymentStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
}

export enum ChargeStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  EXONERATED = "EXONERATED",
  PARTIAL = "PARTIAL",
}

export enum ChargeType {
  REGULAR = "REGULAR",
  SPECIAL = "SPECIAL",
}

export enum PaymentCurrency {
  DIVISAS = "DIVISAS",
  BS = "BS",
}

export interface User {
  id: string;
  cedula: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: UserRole;
  isActive?: boolean;
  createdAt?: string;
}

export interface Tower {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
}

export interface Property {
  id: string;
  code: string;
  tower?: Tower | null;
  aliquotPercentage: number;
  owner?: User;
  /** Persona autorizada a operar la unidad; puede ser el mismo titular. */
  authorized?: User | null;
  createdAt?: string;
}

export interface ChargeConfirmedPayment {
  id: string;
  reference: string;
  bank: string;
  paymentDate: string;
  amount: number;
  amountBs: number | null;
  currency: PaymentCurrency;
  ownerName: string | null;
  receiptNumber: string | null;
}

/** Pago registrado por el vecino que el administrador aún no ha revisado. */
export interface ChargePendingPayment {
  id: string;
  amount: number;
  amountBs: number | null;
  currency: PaymentCurrency;
  reference: string;
  bank: string;
  paymentDate: string;
}

export interface Charge {
  id: string;
  period: string;
  description: string;
  type: ChargeType;
  amount: number;
  amountPaid?: number;
  moraAmount?: number;
  dueDate: string;
  status: ChargeStatus;
  overdue?: boolean;
  amountDue?: number;
  amountDueDivisas?: number;
  confirmedPayment?: ChargeConfirmedPayment | null;
  pendingPayment?: ChargePendingPayment | null;
  property?: { id: string; code: string; tower?: { id: string; name: string } | null };
  createdAt?: string;
}

export type Invoice = Charge;

export interface Receipt {
  id: string;
  receiptNumber: string;
  pdfFilePath: string;
  issuedAt: string;
  /** Cuota que ampara este recibo (directa o cerrada en cascada). */
  charge?: Charge | null;
}

export interface Payment {
  id: string;
  property: Property;
  submittedBy: User;
  charge?: Charge | null;
  amount: number;
  currency: PaymentCurrency;
  exchangeRate?: number | null;
  amountBs?: number | null;
  bank: string;
  reference: string;
  paymentDate: string;
  proofFilePath: string;
  status: PaymentStatus;
  reviewedAt?: string | null;
  rejectReason?: string | null;
  receipts?: Receipt[] | null;
  createdAt: string;
}

export interface AccountStatement {
  balance: number;
  creditBalance: number;
  charges: Charge[];
}

export interface AuthSession {
  token: string;
  user: User;
}
