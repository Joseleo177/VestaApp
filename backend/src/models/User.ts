import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { Property } from "./Property";
import { Payment } from "./Payment";

export enum UserRole {
  ADMIN = "ADMIN",
  OWNER = "OWNER",
}

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  cedula!: string;

  // select:false => nunca se incluye en consultas por defecto (evita filtrarlo
  // al serializar relaciones eager como property.owner o payment.submittedBy).
  @Column({ name: "password_hash", select: false })
  passwordHash!: string;

  @Column({ name: "full_name" })
  fullName!: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.OWNER })
  role!: UserRole;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @Column({ name: "credit_balance", type: "decimal", precision: 10, scale: 2, default: 0 })
  creditBalance!: number;

  @OneToMany(() => Property, (property) => property.owner)
  properties!: Property[];

  @OneToMany(() => Payment, (payment) => payment.submittedBy)
  payments!: Payment[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
