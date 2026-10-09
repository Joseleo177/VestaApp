import bcrypt from "bcryptjs";
import { AppDataSource } from "../config/data-source";
import { DocumentType, User, UserRole, isDocumentType } from "../models/User";
import { HttpError } from "../middlewares/error.middleware";

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
};
