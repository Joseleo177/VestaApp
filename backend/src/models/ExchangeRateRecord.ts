import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { User } from "./User";

/**
 * Moneda de la tasa BCV. Una cuota se cobra "a tasa" de una de ellas: el monto
 * de la cuota siempre es en divisas ($ en efectivo o transferencia), y la
 * moneda solo decide con qué tasa se convierte a bolívares.
 */
export enum RateCurrency {
  USD = "USD",
  EUR = "EUR",
}

export const RATE_CURRENCIES = [RateCurrency.USD, RateCurrency.EUR] as const;

export function isRateCurrency(value: unknown): value is RateCurrency {
  return value === RateCurrency.USD || value === RateCurrency.EUR;
}

@Entity({ name: "exchange_rate_records" })
@Unique("UQ_exchange_rate_date_currency", ["date", "currency"])
export class ExchangeRateRecord {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** Fecha de la tasa (YYYY-MM-DD). Única por día y moneda. */
  @Column()
  date!: string;

  @Column({ type: "varchar", length: 3, default: RateCurrency.EUR })
  currency!: RateCurrency;

  /** Bolívares por 1 unidad de `currency`. */
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
