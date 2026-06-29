import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "../models/User";

export interface AuthPayload {
  sub: string; // user id
  role: UserRole;
  cedula: string;
}

// Extiende el Request de Express para llevar el usuario autenticado.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Verifica el JWT del header Authorization: Bearer <token>.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token no proporcionado" });
    return;
  }

  const token = header.substring(7);
  try {
    const payload = jwt.verify(token, env.jwt.secret) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: "Token inválido o expirado" });
  }
}

/**
 * Restringe el acceso a uno o más roles. Usar después de `authenticate`.
 *   router.post("/", authenticate, authorize(UserRole.ADMIN), handler)
 */
export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "No autorizado para esta acción" });
      return;
    }
    next();
  };
}
