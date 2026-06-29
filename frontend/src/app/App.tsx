import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { router } from "./router";

/** Raíz de la aplicación: providers globales + router + toasts. */
export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
