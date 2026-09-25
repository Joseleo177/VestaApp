import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Property } from "./Property";
import { User } from "./User";
import { Charge } from "./Charge";
import { Receipt } from "./Receipt";
import { RateCurrency } from "./ExchangeRateRecord";
import { PaymentTarget } from "./PaymentTarget";
import { PaymentApplication } from "./PaymentApplication";

export enum PaymentStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
}

/** Tipo de pago: en divisas ($) anula la mora; en bolívares la mantiene. */
export enum PaymentCurrency {
  DIVISAS = "DIVISAS",
  BS = "BS",
}

@Entity({ name: "payments" })
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Property, (property) => property.payments, { eager: true })
  @JoinColumn({ name: "property_id" })
  property!: Property;

  @ManyToOne(() => User, (user) => user.payments, { eager: true })
  @JoinColumn({ name: "submitted_by" })
  submittedBy!: User;

  @ManyToOne(() => Charge, { nullable: true, eager: true })
  @JoinColumn({ name: "charge_id" })
  charge?: Charge | null;

  // Monto efectivo en divisas que salda el pago (base, o base+mora si Bs con
  // mora). En pagos en Bs es el equivalente a la tasa de la cuota pagada.
  @Column({ type: "numeric", precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: "enum", enum: PaymentCurrency, default: PaymentCurrency.DIVISAS })
  currency!: PaymentCurrency;

  // Tasa usada (solo en pagos en Bs) y monto equivalente en Bs. La tasa es la
  // de la moneda de la cuota pagada, en la fecha del pago.
  @Column({ name: "exchange_rate", type: "numeric", precision: 18, scale: 6, nullable: true })
  exchangeRate?: number | null;

  /** Moneda de `exchangeRate` (Bs por USD o por EUR). Null en pagos en divisas. */
  @Column({ name: "rate_currency", type: "varchar", length: 3, nullable: true })
  rateCurrency?: RateCurrency | null;

  @Column({ name: "amount_bs", type: "numeric", precision: 18, scale: 2, nullable: true })
  amountBs?: number | null;

  @Column()
  bank!: string;

  @Column()
  reference!: string;

  @Column({ name: "payment_date", type: "date" })
  paymentDate!: string;

  @Column({ name: "proof_file_path", nullable: true })
  proofFilePath?: string;

  @Column({ type: "enum", enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "reviewed_by" })
  reviewedBy?: User | null;

  @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
  reviewedAt?: Date | null;

  @Column({ name: "reject_reason", nullable: true })
  rejectReason?: string;

  /**
   * Divisas que este pago dejó en el saldo a favor del titular al confirmarse.
   * Con cuotas a tasas distintas ya no se puede deducir de `amount`, así que se
   * guarda para revertirlo exacto al borrar. Null en pagos anteriores al campo.
   */
  @Column({ name: "credit_amount", type: "numeric", precision: 12, scale: 2, nullable: true })
  creditAmount?: number | null;

  @OneToMany(() => Receipt, (receipt) => receipt.payment)
  receipts?: Receipt[];

  /** Cuotas elegidas para este pago, en orden (ver `PaymentTarget`). */
  @OneToMany(() => PaymentTarget, (t) => t.payment, { cascade: ["insert"] })
  targets?: PaymentTarget[];

  /** Lo que aplicó a cada cuota al confirmarse. */
  @OneToMany(() => PaymentApplication, (a) => a.payment)
  applications?: PaymentApplication[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
