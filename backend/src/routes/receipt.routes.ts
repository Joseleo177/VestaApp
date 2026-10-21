import { Router } from "express";
import { ReceiptController } from "../controllers/receipt.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { UserRole } from "../models/User";

const router = Router();

// El listado completo es del administrador; el vecino descarga los suyos desde sus pagos.
router.get("/", authenticate, authorize(UserRole.ADMIN), ReceiptController.list);

export default router;
