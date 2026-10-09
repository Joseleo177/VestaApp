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
  /**
   * Persona autorizada a gestionar un departamento sin ser su titular.
   * Un usuario OWNER también puede figurar como autorizado de una propiedad
   * (incluida la suya): el rol define el panel de acceso, la relación
   * `properties.authorized_id` define sobre qué unidades puede operar.
   */
  AUTHORIZED = "AUTHORIZED",
}

/** Letra del documento de identidad: V/E cédula, J/G RIF. */
export enum DocumentType {
  V = "V",
  E = "E",
  J = "J",
  G = "G",
}

export function isDocumentType(value: unknown): value is DocumentType {
  return Object.values(DocumentType).includes(value as DocumentType);
}

/**
 * Documento tal como se imprime: "V-9.613.328" (o "V-9613328" sin `grouped`),
 * o "J-50440139-0" para un RIF de 9 dígitos. Una cédula no numérica (p. ej. la
 * del admin) va tal cual.
 */
export function formatDocumentId(
  tipo: DocumentType | null | undefined,
  cedula: string,
  grouped = true
): string {
  const digits = cedula.replace(/\D/g, "");
  if (!digits || digits !== cedula) return cedula;
  const t = tipo ?? DocumentType.V;
  if ((t === DocumentType.J || t === DocumentType.G) && digits.length === 9) {
    return `${t}-${digits.slice(0, 8)}-${digits.slice(8)}`;
  }
  return `${t}-${grouped ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : digits}`;
}

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  cedula!: string;

  /**
   * Letra del documento (V/E cédula, J/G RIF). Va aparte de `cedula`, que es
   * la credencial de login y se guarda solo con dígitos.
   */
  @Column({ name: "cedula_tipo", type: "varchar", length: 1, default: DocumentType.V })
  cedulaTipo!: DocumentType;

  // select:false => nunca se incluye en consultas por defecto (evita filtrarlo
  // al serializar relaciones eager como property.owner o payment.submittedBy).
  @Column({ name: "password_hash", select: false })
  passwordHash!: string;

  @Column({ name: "full_name" })
  fullName!: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.OWNER })
  role!: UserRole;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @Column({ name: "credit_balance", type: "decimal", precision: 10, scale: 2, default: 0 })
  creditBalance!: number;

  @OneToMany(() => Property, (property) => property.owner)
  properties!: Property[];

  /** Departamentos donde figura como autorizado (puede o no ser el titular). */
  @OneToMany(() => Property, (property) => property.authorized)
  authorizedProperties!: Property[];

  @OneToMany(() => Payment, (payment) => payment.submittedBy)
  payments!: Payment[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
