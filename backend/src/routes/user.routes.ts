import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { UserRole } from "../models/User";

const router = Router();

// Todo el módulo de usuarios es exclusivo del administrador.
router.use(authenticate, authorize(UserRole.ADMIN));

router.get("/", UserController.list);
router.post("/", UserController.create);
router.patch("/:id", UserController.update);
router.patch("/:id/status", UserController.setStatus);

export default router;
