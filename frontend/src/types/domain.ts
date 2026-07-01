export enum UserRole {
  ADMIN = "ADMIN",
  OWNER = "OWNER",
}

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
  property?: { id: string; code: string; tower?: { id: string; name: string } | null };
  createdAt?: string;
}

export type Invoice = Charge;

export interface Receipt {
  id: string;
  receiptNumber: string;
  pdfFilePath: string;
  issuedAt: string;
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
