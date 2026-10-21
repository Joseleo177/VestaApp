import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { UserRole } from "@/types/domain";
import { ApiError } from "@/services/api";
import { useAuth } from "../hooks/useAuth";
import { loginSchema, LoginFormValues } from "../schema";

/** Id del campo de usuario: la portada lo enfoca desde sus botones "Iniciar sesión". */
export const LOGIN_FIELD_ID = "cedula";

/**
 * Tarjeta de acceso. El error se muestra dentro de la tarjeta y no en un toast:
 * quien se equivocó de clave está mirando el formulario, no la esquina.
 */
export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setError(null);
    try {
      const user = await login(values.cedula.trim(), values.password);
      navigate(user.role === UserRole.ADMIN ? "/admin" : "/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión. Revisa tu conexión.");
    }
  };

  return (
    <div className="rounded-3xl border border-black/[0.06] bg-ios-card p-6 shadow-ios-lg dark:border-white/10 sm:p-8">
      <h2 className="text-[22px] font-bold leading-tight text-ios-label">Entra a tu cuenta</h2>
      <p className="mt-1 text-[14px] text-ios-secondary">Consulta tus cuotas y registra tus pagos.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        {/* Ni ayuda ni ejemplo de qué es el usuario: es una pantalla pública, y
            decir su formato le ahorra la mitad del trabajo a quien quiera adivinarlo. */}
        <Input
          id={LOGIN_FIELD_ID}
          type="text"
          label="Usuario"
          placeholder="Tu usuario"
          autoComplete="username"
          autoCapitalize="none"
          icon={<User className="h-[18px] w-[18px]" />}
          error={errors.cedula?.message}
          {...register("cedula")}
        />
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          label="Contraseña"
          placeholder="••••••••"
          autoComplete="current-password"
          icon={<Lock className="h-[18px] w-[18px]" />}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ios-secondary transition-colors hover:text-ios-label"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          }
          error={errors.password?.message}
          {...register("password")}
        />

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3.5 py-3 text-[13px] font-medium text-red-700 dark:text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? "Verificando…" : "Entrar"}
          {!isSubmitting && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      <p className="mt-6 border-t border-ios-separator pt-5 text-[13px] leading-relaxed text-ios-secondary">
        ¿No tienes usuario u olvidaste tu contraseña? Pídeselo a la administración de tu asociación.
      </p>
    </div>
  );
}
