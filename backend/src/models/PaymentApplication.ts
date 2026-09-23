import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Payment } from "./Payment";
import { Charge } from "./Charge";

/**
 * Cuánto aplicó un pago a una cuota concreta: la cuota directa y cada una que
 * cerró la cascada del excedente.
 *
 * Sin este registro no había forma de deshacer un pago con exactitud — el
 * borrado adivinaba recorriendo las cuotas del titular y terminaba quitándole
 * el dinero a cuotas que había pagado OTRO pago. Los `Receipt` no sirven de
 * libro mayor porque solo existen para las cuotas que quedaron totalmente
 * pagadas, no para los abonos parciales.
 */
@Entity({ name: "payment_applications" })
export class PaymentApplication {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Payment, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "payment_id" })
  payment!: Payment;

  @ManyToOne(() => Charge, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "charge_id" })
  charge!: Charge;

  /** EUR que este pago aportó a esta cuota. */
  @Column({ type: "numeric", precision: 12, scale: 2 })
  amount!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
