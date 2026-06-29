import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/** Acceso tipado al estado de sesión. Falla rápido si falta el provider. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}
