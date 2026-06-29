import { ReactNode } from "react";
import { ExchangeRateProvider } from "@/features/exchange-rate/context/ExchangeRateContext";
import { TopBar } from "./topbar/TopBar";

/**
 * Layout principal autenticado: top bar (con cajón de apps y tasa BCV) + main.
 * Provee la tasa de cambio a todo el árbol autenticado.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ExchangeRateProvider>
      <div className="min-h-screen bg-slate-50">
        <TopBar />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </ExchangeRateProvider>
  );
}
