import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { UserRole } from "../models/User";
import { SettingsController } from "../controllers/settings.controller";

const router = Router();

router.get("/",    authenticate, authorize(UserRole.ADMIN), SettingsController.getAll);
router.patch("/",  authenticate, authorize(UserRole.ADMIN), SettingsController.update);

export default router;
