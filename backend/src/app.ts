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
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Todas las rutas de la API bajo /api.
  app.use("/api", routes);

  // Manejo central de errores (siempre al final).
  app.use(errorHandler);

  return app;
}
