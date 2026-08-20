import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { UserRole } from "../models/User";
import { ReportController } from "../controllers/report.controller";

const router = Router();

// La ruta de estado de cuenta es para todos (el controlador filtra si no es admin)
router.get("/statement", authenticate, ReportController.exportAccountStatement);

// Ambos reportes de Excel son solo para administradores
router.use(authenticate, authorize(UserRole.ADMIN));

router.get("/collected", ReportController.exportCollectedPayments);
router.get("/debt", ReportController.exportOwedCharges);

export default router;
