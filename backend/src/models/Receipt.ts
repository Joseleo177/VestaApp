import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Payment } from "./Payment";
import { User } from "./User";

/**
 * Recibo PDF generado cuando un pago se confirma. Relación 1:1 con Payment.
 */
@Entity({ name: "receipts" })
export class Receipt {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @OneToOne(() => Payment, (payment) => payment.receipt)
  @JoinColumn({ name: "payment_id" })
  payment!: Payment;

  @Column({ name: "receipt_number", unique: true })
  receiptNumber!: string; // "REC-2026-000123"

  @Column({ name: "pdf_file_path", nullable: true })
  pdfFilePath?: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "issued_by" })
  issuedBy!: User;

  @CreateDateColumn({ name: "issued_at" })
  issuedAt!: Date;
}
