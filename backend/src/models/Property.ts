import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { Charge } from "./Charge";
import { Payment } from "./Payment";
import { Tower } from "./Tower";

@Entity({ name: "properties" })
export class Property {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  code!: string;

  @ManyToOne(() => Tower, (tower) => tower.properties, {
    nullable: true,
    eager: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "tower_id" })
  tower?: Tower | null;

  @Column({
    name: "aliquot_percentage",
    type: "numeric",
    precision: 5,
    scale: 2,
    default: 0,
  })
  aliquotPercentage!: number;

  @ManyToOne(() => User, (user) => user.properties, { eager: true })
  @JoinColumn({ name: "owner_id" })
  owner!: User;

  /**
   * Persona autorizada a operar el departamento (ver estado de cuenta,
   * registrar pagos, descargar recibos). Puede ser el mismo titular.
   */
  @ManyToOne(() => User, (user) => user.authorizedProperties, {
    nullable: true,
    eager: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "authorized_id" })
  authorized?: User | null;

  @OneToMany(() => Charge, (charge) => charge.property)
  charges!: Charge[];

  @OneToMany(() => Payment, (payment) => payment.property)
  payments!: Payment[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
