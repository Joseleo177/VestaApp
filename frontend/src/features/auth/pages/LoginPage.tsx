import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { UserRole } from "@/types/domain";
import { loginSchema, LoginFormValues } from "../schema";
import { ApiError } from "@/services/api";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const user = await login(values.cedula, values.password);
      toast.success(`Bienvenido, ${user.fullName}`);
      navigate(user.role === UserRole.ADMIN ? "/admin" : "/", { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo iniciar sesión";
      toast.error(message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">CondoApp</h1>
          <p className="text-sm text-slate-500">Gestión y pagos de condominio</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <Input
            id="cedula"
            type="text"
            label="Número de cédula"
            placeholder="Ej. 12345678"
            autoComplete="username"
            error={errors.cedula?.message}
            {...register("cedula")}
          />
          <Input
            id="password"
            type="password"
            label="Contraseña"
            placeholder="••••••••"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Iniciar sesión
          </Button>

          <p className="pt-2 text-center text-xs text-slate-400">
            Demo — Admin: 00000000 / admin123 · Vecino: 12345678 / owner123
          </p>
        </form>
      </div>
    </div>
  );
}
