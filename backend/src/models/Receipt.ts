import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Payment } from "./Payment";
import { User } from "./User";
import { Charge } from "./Charge";

/**
 * Recibo PDF generado cuando un pago confirma una cuota.
 * Un pago puede generar múltiples recibos (uno por cuota cerrada en cascada).
 */
@Entity({ name: "receipts" })
export class Receipt {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Payment, (payment) => payment.receipts)
  @JoinColumn({ name: "payment_id" })
  payment!: Payment;

  /** Cuota específica que cubre este recibo (directa o cerrada por cascada). */
  @ManyToOne(() => Charge, { nullable: true, eager: false })
  @JoinColumn({ name: "charge_id" })
  charge?: Charge | null;

  @Column({ name: "receipt_number", unique: true })
  receiptNumber!: string; // "RC-0001"

  @Column({ name: "pdf_file_path", nullable: true })
  pdfFilePath?: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "issued_by" })
  issuedBy!: User;

  @CreateDateColumn({ name: "issued_at" })
  issuedAt!: Date;
}
