import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { UserRole } from "../models/User";

const router = Router();

router.post("/login", AuthController.login);
// Registro reservado al administrador para dar de alta copropietarios.
router.post(
  "/register",
  authenticate,
  authorize(UserRole.ADMIN),
  AuthController.register
);
router.get("/me", authenticate, AuthController.me);
router.patch("/profile", authenticate, AuthController.updateProfile);

export default router;
