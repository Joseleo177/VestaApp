import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

@Entity({ name: "bank_entries" })
export class BankEntry {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  referencia!: string;

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
