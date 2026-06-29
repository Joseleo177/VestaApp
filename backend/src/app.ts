import "reflect-metadata";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import routes from "./routes";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/error.middleware";

export function createApp() {
  const app = express();

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
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Todas las rutas de la API bajo /api.
  app.use("/api", routes);

  // Manejo central de errores (siempre al final).
  app.use(errorHandler);

  return app;
}
