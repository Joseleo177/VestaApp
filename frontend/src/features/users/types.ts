import { UserRole } from "@/types/domain";

export interface CreateUserInput {
  cedula: string;
  password: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: UserRole;
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, "password">> & {
  password?: string;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: "Administrador",
  [UserRole.OWNER]: "Copropietario",
};
