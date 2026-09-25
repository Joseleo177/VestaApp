import { Request, Response, NextFunction } from "express";

interface Options {
  /** Ventana de conteo en milisegundos. */
  windowMs: number;
  /** Peticiones permitidas por IP dentro de la ventana. */
  max: number;
  message?: string;
}

/**
 * Limitador de peticiones por IP con ventana fija, en memoria.
 *
 * En Vercel cada instancia de la función lleva su propio contador, así que no
 * es un límite global exacto: frena ráfagas y fuerza bruta antes de que lleguen
 * a la base de datos. El bloqueo duro va en el firewall de Vercel (ver README).
 */
export function rateLimit({ windowMs, max, message }: Options) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = req.ip ?? "unknown";

    // Purga perezosa para que el mapa no crezca sin límite.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;

    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({
        message: message ?? "Demasiadas peticiones, intenta de nuevo en un momento",
      });
      return;
    }
    next();
  };
}
