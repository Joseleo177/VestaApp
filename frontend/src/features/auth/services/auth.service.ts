import { api } from "@/services/api";
import { AuthSession, User } from "@/types/domain";

interface LoginCredentials {
  cedula: string;
  password: string;
}

/** Capa de datos de autenticación. Los componentes nunca llaman a la API directo. */
export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const { data } = await api.post<AuthSession>("/auth/login", credentials);
    return data;
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>("/auth/me");
    return data;
  },
};
