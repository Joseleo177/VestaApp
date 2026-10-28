import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { User } from "./User";

/**
 * Cuenta de la que viene el movimiento: la de bolívares o la de divisas. Cada
 * extracto se sube a una de las dos y solo casa con pagos de su moneda.
 */
export enum BankEntryCurrency {
  BS = "BS",
  USD = "USD",
}

@Entity({ name: "bank_entries" })
// Cada banco numera sus referencias por su lado: la misma puede repetirse en el
// extracto en Bs y en el de divisas sin ser el mismo movimiento.
@Unique("UQ_bank_entries_currency_referencia", ["currency", "referencia"])
export class BankEntry {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  referencia!: string;

  @Column({ type: "varchar", length: 3, default: BankEntryCurrency.BS })
  currency!: BankEntryCurrency;

  @Column({ type: "numeric", precision: 18, scale: 2 })
  monto!: number;

  @Column({ nullable: true })
  fecha?: string;

  @Column({ nullable: true })
  descripcion?: string;

  @Column({ default: false })
  matched!: boolean;

  @ManyToOne(() => User, { nullable: true, eager: false, onDelete: "SET NULL" })
  @JoinColumn({ name: "uploaded_by" })
  uploadedBy?: User | null;

  @CreateDateColumn({ name: "uploaded_at" })
  uploadedAt!: Date;
}
