import { useEffect, useRef } from "react";

/** Al volver a la pestaña no se refresca si la última carga es más reciente que esto. */
const MIN_REFRESH_GAP_MS = 15_000;

/**
 * Ejecuta `tick` cada `intervalMs` solo mientras la pestaña está visible, y una
 * vez al volver a ella si los datos ya quedaron viejos. Una pestaña olvidada en
 * segundo plano no genera tráfico contra la API ni la base de datos.
 * No hace la carga inicial: el hook que lo usa la dispara al montarse.
 */
export function usePolling(tick: () => void, intervalMs: number): void {
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    let lastRun = Date.now();
    const run = () => {
      lastRun = Date.now();
      tickRef.current();
    };

    const id = setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, intervalMs);

    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRun >= MIN_REFRESH_GAP_MS
      ) {
        run();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
}
