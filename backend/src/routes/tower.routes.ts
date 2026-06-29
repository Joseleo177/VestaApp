import { Router } from "express";
import { TowerController } from "../controllers/tower.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { UserRole } from "../models/User";

const router = Router();
router.use(authenticate);

router.get("/", TowerController.list);
router.post("/", authorize(UserRole.ADMIN), TowerController.create);
router.patch("/:id", authorize(UserRole.ADMIN), TowerController.update);
router.delete("/:id", authorize(UserRole.ADMIN), TowerController.remove);

export default router;
