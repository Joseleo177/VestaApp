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

export enum PaymentStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
}

/** Tipo de pago: en divisas (EUR) anula la mora; en bolívares la mantiene. */
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

  // Monto efectivo en EUR que salda el pago (base, o base+mora si Bs con mora).
  @Column({ type: "numeric", precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: "enum", enum: PaymentCurrency, default: PaymentCurrency.DIVISAS })
  currency!: PaymentCurrency;

  // Tasa Bs/EUR usada (solo en pagos en Bs) y monto equivalente en Bs.
  @Column({ name: "exchange_rate", type: "numeric", precision: 18, scale: 6, nullable: true })
  exchangeRate?: number | null;

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

  @OneToMany(() => Receipt, (receipt) => receipt.payment)
  receipts?: Receipt[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
