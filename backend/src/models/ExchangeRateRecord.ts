import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

@Entity({ name: "exchange_rate_records" })
export class ExchangeRateRecord {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** Fecha de la tasa — única por día (YYYY-MM-DD). */
  @Column({ unique: true })
  date!: string;

  /** Bolívares por 1 EUR. */
  @Column({ type: "numeric", precision: 12, scale: 4 })
  rate!: number;

  /** "BCV" si fue obtenida automáticamente; "MANUAL" si la ingresó el admin. */
  @Column({ default: "BCV" })
  source!: string;

  @ManyToOne(() => User, { nullable: true, eager: false, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  createdBy?: User | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
