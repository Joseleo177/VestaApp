import { Router } from "express";
import { PropertyController } from "../controllers/property.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { UserRole } from "../models/User";

const router = Router();
router.use(authenticate);

router.get("/me", PropertyController.listMine);
router.get("/", authorize(UserRole.ADMIN), PropertyController.listAll);
router.post("/", authorize(UserRole.ADMIN), PropertyController.create);
router.patch("/:id", authorize(UserRole.ADMIN), PropertyController.update);

export default router;
