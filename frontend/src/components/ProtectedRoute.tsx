import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { UserRole } from "@/types/domain";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
}

/** Bloquea rutas según sesión y rol. Redirige al login o al panel correcto. */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && role !== requiredRole) {
    // Rol incorrecto: enviar a su panel por defecto.
    return <Navigate to={role === UserRole.ADMIN ? "/admin" : "/"} replace />;
  }

  return <>{children}</>;
}
