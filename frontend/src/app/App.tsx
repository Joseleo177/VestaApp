import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { router } from "./router";

/** Toasts que siguen el tema activo (sonner necesita el valor explícito). */
function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster richColors position="top-right" theme={theme} />;
}

/** Raíz de la aplicación: providers globales + router + toasts. */
export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        <ThemedToaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
