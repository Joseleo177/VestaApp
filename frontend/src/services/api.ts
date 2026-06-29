import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";
import { toast } from "sonner";

const STORAGE_KEY = "condo.session";

/** Lee el token persistido sin acoplar este módulo al AuthContext. */
function readToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

/**
 * Instancia única de Axios. PROHIBIDO usar axios/fetch directamente en los
 * componentes: todo pasa por esta capa con interceptores centralizados.
 */
export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api",
  timeout: 20000,
});

// --- Request: inyecta el JWT automáticamente ---
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = readToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Response: captura errores globales ---
interface ApiErrorBody {
  message?: string;
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ?? "Ocurrió un error inesperado";

    if (status === 401) {
      // Sesión expirada/ inválida: limpia y redirige al login.
      localStorage.removeItem(STORAGE_KEY);
      if (!window.location.pathname.startsWith("/login")) {
        toast.error("Tu sesión expiró. Inicia sesión de nuevo.");
        window.location.assign("/login");
      }
    } else if (status && status >= 500) {
      toast.error("Error del servidor. Intenta más tarde.");
    }

    return Promise.reject(new ApiError(message, status));
  }
);

/** Error normalizado para que las features manejen mensajes consistentes. */
export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export { STORAGE_KEY };
