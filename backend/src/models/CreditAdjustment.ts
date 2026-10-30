import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

/**
 * Corrección manual del saldo a favor de un titular. El saldo vive en
 * `User.creditBalance` y lo mueven los pagos (sobrantes, pagos con saldo); lo que
 * la junta directiva cambie a mano queda aquí, con su motivo, para poder
 * explicar después de dónde salió.
 */
@Entity({ name: "credit_adjustments" })
export class CreditAdjustment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "user_id" })
  user!: User;

  /** Divisas sumadas (positivo) o quitadas (negativo) al saldo. */
  @Column({ type: "numeric", precision: 12, scale: 2 })
  amount!: number;

  @Column({ name: "balance_after", type: "numeric", precision: 12, scale: 2 })
  balanceAfter!: number;

  @Column({ type: "text" })
  reason!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  createdBy?: User | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
