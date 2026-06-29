import multer from "multer";
import path from "path";
import fs from "fs";
import { env } from "../config/env";

// Carpeta donde se guardan los comprobantes de pago subidos.
const proofsDir = path.join(env.uploadsDir, "proofs");
fs.mkdirSync(proofsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, proofsDir),
  filename: (req, file, cb) => {
    // Nombre único: <userId>-<timestamp>.<ext>
    const ext = path.extname(file.originalname).toLowerCase();
    const userId = req.user?.sub ?? "anon";
    cb(null, `${userId}-${Date.now()}${ext}`);
  },
});

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/**
 * Middleware multer para subir el comprobante de pago. Acepta imágenes y PDF
 * hasta 5MB. Usar como: upload.single("proof").
 */
export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato no permitido. Usa JPG, PNG, WEBP o PDF."));
    }
  },
});

const XLSX_MIME = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

/**
 * Middleware multer en memoria para extractos bancarios Excel (.xlsx).
 * Usar como: uploadXlsx.single("statement").
 */
export const uploadXlsx = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (XLSX_MIME.includes(file.mimetype) || file.originalname.endsWith(".xlsx")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se aceptan archivos Excel (.xlsx)"));
    }
  },
});
