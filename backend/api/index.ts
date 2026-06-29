import { createApp } from "../src/app";
import { AppDataSource } from "../src/config/data-source";
import type { Request, Response } from "express";

const app = createApp();

// Cachea la conexión entre invocaciones serverless para no agotar el pool de Supabase
let dbReady: Promise<void> | null = null;

function ensureDb(): Promise<void> {
  if (AppDataSource.isInitialized) return Promise.resolve();
  if (!dbReady) {
    dbReady = AppDataSource.initialize().catch((err) => {
      dbReady = null; // permite reintentar en la siguiente invocación
      throw err;
    });
  }
  return dbReady;
}

export default async function handler(req: Request, res: Response) {
  await ensureDb();
  return app(req, res);
}
