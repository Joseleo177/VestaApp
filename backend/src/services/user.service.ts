import bcrypt from "bcryptjs";
import { AppDataSource } from "../config/data-source";
import { DocumentType, User, UserRole, isDocumentType } from "../models/User";
import { HttpError } from "../middlewares/error.middleware";
import { CreditAdjustment } from "../models/CreditAdjustment";

const repo = () => AppDataSource.getRepository(User);

/** Valida la letra del documento; sin ella queda la que ya tenía (o V al crear). */
export function parseDocumentType(value: unknown): DocumentType | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!isDocumentType(value)) throw new HttpError(400, "Tipo de documento inválido (V, E, J o G)");
  return value;
}

/** Vista pública del usuario (nunca expone el hash de contraseña). */
export interface PublicUser {
  id: string;
  cedula: string;
  cedulaTipo: DocumentType;
  fullName: string;
  phone?: string;
  email?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    cedula: u.cedula,
    cedulaTipo: u.cedulaTipo,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
  };
}

export interface CreateUserInput {
  cedula: string;
  cedulaTipo?: DocumentType;
  password: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: UserRole;
}

export interface UpdateUserInput {
  cedula?: string;
  cedulaTipo?: DocumentType;
  fullName?: string;
  phone?: string;
  email?: string;
  role?: UserRole;
  password?: string;
}

export const UserService = {
  async list(): Promise<PublicUser[]> {
    const users = await repo().find({ order: { createdAt: "DESC" } });
    return users.map(toPublicUser);
  },

  async getById(id: string): Promise<User> {
    const user = await repo().findOneBy({ id });
    if (!user) throw new HttpError(404, "Usuario no encontrado");
    return user;
  },

  async create(input: CreateUserInput): Promise<PublicUser> {
    const exists = await repo().findOneBy({ cedula: input.cedula });
    if (exists) throw new HttpError(409, "La cédula ya está registrada");

    const user = repo().create({
      cedula: input.cedula,
      cedulaTipo: input.cedulaTipo ?? DocumentType.V,
      passwordHash: await bcrypt.hash(input.password, 10),
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      role: input.role,
    });
    return toPublicUser(await repo().save(user));
  },

  async update(id: string, input: UpdateUserInput): Promise<PublicUser> {
    const user = await this.getById(id);

    if (input.cedula && input.cedula !== user.cedula) {
      const exists = await repo().findOneBy({ cedula: input.cedula });
      if (exists) throw new HttpError(409, "La cédula ya está en uso");
      user.cedula = input.cedula;
    }
    if (input.cedulaTipo !== undefined) user.cedulaTipo = input.cedulaTipo;
    if (input.fullName !== undefined) user.fullName = input.fullName;
    if (input.phone !== undefined) user.phone = input.phone;
    if (input.email !== undefined) user.email = input.email;
    if (input.role !== undefined) user.role = input.role;
    if (input.password) user.passwordHash = await bcrypt.hash(input.password, 10);

    return toPublicUser(await repo().save(user));
  },

  /** Activa o desactiva el acceso del usuario al sistema. */
  async setActive(
    id: string,
    isActive: boolean,
    actingUserId: string
  ): Promise<PublicUser> {
    if (id === actingUserId && !isActive) {
      throw new HttpError(400, "No puedes desactivar tu propio usuario");
    }
    const user = await this.getById(id);
    user.isActive = isActive;
    return toPublicUser(await repo().save(user));
  },

  /** Saldo a favor del titular y sus últimas correcciones manuales. */
  async getCredit(id: string): Promise<CreditInfo> {
    const user = await this.getById(id);
    const adjustments = await AppDataSource.getRepository(CreditAdjustment).find({
      where: { user: { id } },
      relations: { createdBy: true },
      order: { createdAt: "DESC" },
      take: 10,
    });
    return {
      creditBalance: Number(user.creditBalance ?? 0),
      adjustments: adjustments.map((a) => ({
        id: a.id,
        amount: Number(a.amount),
        balanceAfter: Number(a.balanceAfter),
        reason: a.reason,
        createdBy: a.createdBy?.fullName ?? null,
        createdAt: a.createdAt,
      })),
    };
  },

  /**
   * Corrige a mano el saldo a favor de un titular (lo deja en `balance`). Queda
   * registrado cuánto cambió, por qué y quién lo hizo.
   */
  async setCredit(id: string, balance: number, reason: string, adminId: string): Promise<CreditInfo> {
    const motivo = (reason ?? "").trim();
    if (motivo.length < 5) throw new HttpError(400, "Indica el motivo del ajuste (mínimo 5 caracteres)");
    if (!Number.isFinite(balance) || balance < 0) throw new HttpError(400, "El saldo debe ser 0 o mayor");
    const target = Math.round(balance * 100) / 100;

    await AppDataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id }, lock: { mode: "pessimistic_write" } });
      if (!user) throw new HttpError(404, "Usuario no encontrado");
      const delta = Math.round((target - Number(user.creditBalance ?? 0)) * 100) / 100;
      if (delta === 0) throw new HttpError(409, "El saldo ya es ese");
      user.creditBalance = target;
      await manager.save(User, user);
      await manager.save(
        manager.create(CreditAdjustment, {
          user: { id } as User,
          amount: delta,
          balanceAfter: target,
          reason: motivo,
          createdBy: { id: adminId } as User,
        })
      );
    });
    return this.getCredit(id);
  },
};

export interface CreditInfo {
  creditBalance: number;
  adjustments: {
    id: string;
    amount: number;
    balanceAfter: number;
    reason: string;
    createdBy: string | null;
    createdAt: Date;
  }[];
}
