import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Flame,
  Lock,
  Moon,
  Receipt,
  Sun,
  User,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/lib/theme";
import { useAuth } from "../hooks/useAuth";
import { UserRole } from "@/types/domain";
import { loginSchema, LoginFormValues } from "../schema";
import { ApiError } from "@/services/api";

const HIGHLIGHTS = [
  { icon: Receipt, title: "Tus cuotas al día", text: "Estado de cuenta y vencimientos siempre a la mano" },
  { icon: CreditCard, title: "Paga y reporta", text: "Registra el pago con su referencia en segundos" },
  { icon: FileText, title: "Recibos en PDF", text: "Cada cuota saldada emite su recibo descargable" },
];

export function LoginPage() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-ios-bg lg:grid lg:grid-cols-2">
      {/*
        Panel de marca. Usa la paleta índigo fija (no los tokens de marca), porque
        en modo noche esos tokens se aclaran y el texto blanco perdería contraste.
      */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Halos decorativos */}
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl"
          aria-hidden
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Flame className="h-6 w-6" />
          </span>
          <span className="text-xl font-bold tracking-tight">VestaApp</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[32px] font-bold leading-tight">
            La administración de tu asociación, sin planillas sueltas.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/70">
            Cuotas, pagos y recibos en un solo lugar, para la junta y para cada vecino.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{title}</span>
                  <span className="block text-[13px] text-white/60">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} VestaApp · Gestión y pagos de la asociación
        </p>
      </aside>

      {/* Formulario */}
      <main className="relative flex min-h-screen items-center justify-center px-4 py-10 lg:min-h-0">
        <button
          onClick={toggle}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-ios-card text-ios-secondary shadow-ios transition-colors hover:text-ios-label"
          aria-label={theme === "dark" ? "Cambiar a modo día" : "Cambiar a modo noche"}
          title={theme === "dark" ? "Modo día" : "Modo noche"}
        >
          {theme === "dark" ? (
            <Sun className="h-[18px] w-[18px]" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </button>

        <div className="w-full max-w-sm">
          {/* Marca compacta: sustituye al panel cuando no hay ancho para mostrarlo */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <Flame className="h-6 w-6" />
            </span>
            <span className="text-xl font-bold tracking-tight text-ios-label">VestaApp</span>
          </div>

          <div className="mb-7">
            <h1 className="text-[28px] font-bold leading-tight text-ios-label">Bienvenido</h1>
            <p className="mt-1 text-[15px] text-ios-secondary">
              Ingresa para ver tu estado de cuenta
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              id="cedula"
              type="text"
              label="Usuario"
              autoComplete="username"
              icon={<User className="h-[18px] w-[18px]" />}
              error={errors.cedula?.message}
              {...register("cedula")}
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              label="Contraseña"
              autoComplete="current-password"
              icon={<Lock className="h-[18px] w-[18px]" />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ios-secondary transition-colors hover:text-ios-label"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              }
              error={errors.password?.message}
              {...register("password")}
            />
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              Iniciar sesión
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-ios-secondary">
            ¿Problemas para entrar? Contacta a la administración de la asociación.
          </p>
        </div>
      </main>
    </div>
  );
}
