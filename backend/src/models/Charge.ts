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

  @Column({ type: "numeric", precision: 12, scale: 2 })
  amount!: number;

  @Column({ name: "mora_amount", type: "numeric", precision: 12, scale: 2, default: 0 })
  moraAmount!: number;

  @Column({ name: "due_date", type: "date" })
  dueDate!: string;

  @Column({ type: "enum", enum: ChargeStatus, default: ChargeStatus.PENDING })
  status!: ChargeStatus;

  /** Acumulado confirmado en EUR. Se incrementa con cada pago confirmado. */
  @Column({ name: "amount_paid", type: "numeric", precision: 12, scale: 2, default: 0 })
  amountPaid!: number;

  @OneToMany(() => Payment, (payment) => payment.charge)
  payments?: Payment[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
