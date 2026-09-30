import { Request, Response, NextFunction } from "express";

/**
 * Error de aplicación con código HTTP explícito.
 */
export class HttpError extends Error {
  /** `code` distingue errores que el frontend sabe resolver (p. ej. pidiendo confirmación). */
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/**
 * Manejador central de errores. Debe registrarse al final de la cadena.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json(err.code ? { message: err.message, code: err.code } : { message: err.message });
    return;
  }

  if (err instanceof Error) {
    // Errores de multer u otros conocidos llegan aquí.
    res.status(400).json({ message: err.message });
    return;
  }

  res.status(500).json({ message: "Error interno del servidor" });
}
