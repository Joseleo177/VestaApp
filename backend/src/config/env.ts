import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

const isProd = (process.env.NODE_ENV ?? "development") === "production";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),

  // Supabase / PostgreSQL — acepta DATABASE_URL o variables individuales
  db: {
    url: process.env.DATABASE_URL,                              // Supabase connection string
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "5432", 10),
    user: process.env.DB_USER ?? "condo_admin",
    password: process.env.DB_PASSWORD ?? "changeme",
    name: process.env.DB_NAME ?? "condo_db",
    ssl: isProd,                                                // SSL requerido en Supabase
  },

  jwt: {
    secret: required("JWT_SECRET", "super_secret_change_me"),
    expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  },

  uploadsDir: process.env.UPLOADS_DIR ?? "uploads",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  dbSynchronize:
    process.env.DB_SYNCHRONIZE === "true" ||
    (!isProd && process.env.DB_SYNCHRONIZE !== "false"),
} as const;
