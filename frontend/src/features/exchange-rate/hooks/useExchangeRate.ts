import { useContext } from "react";
import { ExchangeRateContext } from "../context/ExchangeRateContext";

/** Acceso tipado a la tasa BCV. Requiere <ExchangeRateProvider>. */
export function useExchangeRate() {
  const ctx = useContext(ExchangeRateContext);
  if (!ctx) {
    throw new Error("useExchangeRate debe usarse dentro de <ExchangeRateProvider>");
  }
  return ctx;
}
