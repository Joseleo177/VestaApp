import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { Payment } from "./Payment";
import { Charge } from "./Charge";

/**
 * Cuotas que el vecino eligió pagar con un mismo pago (p. ej. las de sus dos
 * departamentos), en el orden en que se saldan. `Payment.charge` sigue siendo
 * la primera, para lo que ya dependía de una sola cuota.
 *
 * Es la intención del pago mientras está en revisión; lo que realmente aplicó
 * al confirmarse queda en `PaymentApplication`. Los pagos anteriores a esta
 * tabla no tienen filas: su única cuota es `Payment.charge`.
 */
@Entity({ name: "payment_targets" })
@Unique("UQ_payment_targets_payment_charge", ["payment", "charge"])
export class PaymentTarget {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Payment, (payment) => payment.targets, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "payment_id" })
  payment!: Payment;

  // CASCADE: si se borra una cuota aún no pagada, el pago simplemente deja de
  // apuntarla y al confirmarse ese monto va a la cascada o al saldo a favor.
  @ManyToOne(() => Charge, (charge) => charge.paymentTargets, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "charge_id" })
  charge!: Charge;

  @Column({ type: "int" })
  position!: number;
}
