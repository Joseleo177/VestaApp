import "reflect-metadata";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import routes from "./routes";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/error.middleware";
import { rateLimit } from "./middlewares/rate-limit.middleware";

export function createApp() {
  const app = express();

  // En Vercel el edge reescribe X-Forwarded-For con la IP real del cliente;
  // sin esto todas las peticiones compartirían la IP del proxy en el limitador.
  if (process.env.VERCEL) app.set("trust proxy", true);

  app.use(helmet());

  // CORS_ORIGIN puede ser un string con URLs separadas por coma
  const allowedOrigins = env.corsOrigin
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => {
        // Permitir requests sin origin (curl, Postman, server-to-server)
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origen no permitido — ${origin}`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Todas las rutas de la API bajo /api. El límite es holgado (varios vecinos
  // pueden compartir la IP del wifi del edificio); solo corta abusos.
  app.use("/api", rateLimit({ windowMs: 60_000, max: 300 }), routes);

  // Manejo central de errores (siempre al final).
  app.use(errorHandler);

  return app;
}
