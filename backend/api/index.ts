import { createApp } from "../src/app";
import { AppDataSource } from "../src/config/data-source";
import type { Request, Response } from "express";

const app = createApp();

let dbReady: Promise<void> | null = null;

function ensureDb(): Promise<void> {
  if (AppDataSource.isInitialized) return Promise.resolve();
  if (!dbReady) {
    dbReady = AppDataSource.initialize()
      .then(() => { /* void */ })
      .catch((err: unknown) => {
        dbReady = null;
        throw err;
      });
  }
  return dbReady;
}

export default async function handler(req: Request, res: Response) {
  await ensureDb();
  return app(req, res);
}
