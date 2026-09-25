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
import { Payment } from "./Payment";
import { Receipt } from "./Receipt";
import { RateCurrency } from "./ExchangeRateRecord";
import { User } from "./User";
import { PaymentTarget } from "./PaymentTarget";

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

@Entity({ name: "charges" })
export class Charge {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Property, (property) => property.charges, { eager: true })
  @JoinColumn({ name: "property_id" })
  property!: Property;

  @Column({ length: 7 })
  period!: string; // "YYYY-MM"

  @Column()
  description!: string;

  @Column({ type: "enum", enum: ChargeType, default: ChargeType.REGULAR })
  type!: ChargeType;

  /** Monto en divisas: se paga tal cual en $ (efectivo o transferencia). */
  @Column({ type: "numeric", precision: 12, scale: 2 })
  amount!: number;

  /** Tasa BCV con la que la cuota se convierte a Bs. Las anteriores al cambio son EUR. */
  @Column({ type: "varchar", length: 3, default: RateCurrency.EUR })
  currency!: RateCurrency;

  @Column({ name: "mora_amount", type: "numeric", precision: 12, scale: 2, default: 0 })
  moraAmount!: number;

  @Column({ name: "due_date", type: "date" })
  dueDate!: string;

  @Column({ type: "enum", enum: ChargeStatus, default: ChargeStatus.PENDING })
  status!: ChargeStatus;

  /** Acumulado confirmado en divisas. Se incrementa con cada pago confirmado. */
  @Column({ name: "amount_paid", type: "numeric", precision: 12, scale: 2, default: 0 })
  amountPaid!: number;

  /**
   * Saldo que el admin perdonó al cerrar una cuota con abono parcial (p. ej. el
   * vecino calculó mal la tasa y pagó 20 de 25). La cuota queda PAID con
   * `amountPaid` intacto: lo pagado y lo condonado se ven por separado.
   */
  @Column({ name: "write_off_amount", type: "numeric", precision: 12, scale: 2, default: 0 })
  writeOffAmount!: number;

  @Column({ name: "write_off_reason", type: "text", nullable: true })
  writeOffReason?: string | null;

  @Column({ name: "written_off_at", type: "timestamptz", nullable: true })
  writtenOffAt?: Date | null;

  @ManyToOne(() => User, { nullable: true, eager: false, onDelete: "SET NULL" })
  @JoinColumn({ name: "written_off_by" })
  writtenOffBy?: User | null;

  @OneToMany(() => Payment, (payment) => payment.charge)
  payments?: Payment[];

  /** Pagos de varias cuotas que incluyen a esta (ver `PaymentTarget`). */
  @OneToMany(() => PaymentTarget, (t) => t.charge)
  paymentTargets?: PaymentTarget[];

  /** Recibo que cubre esta cuota (puede ser de un pago en cascada). */
  @ManyToOne(() => Receipt, { nullable: true, eager: false })
  @JoinColumn({ name: "receipt_id" })
  coveringReceipt?: Receipt | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
