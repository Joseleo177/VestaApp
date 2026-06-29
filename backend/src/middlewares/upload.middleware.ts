import multer from "multer";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Middleware para comprobantes de pago (memoria — sin escritura en disco). */
export const upload = multer({
  storage: multer.memoryStorage(),
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

/** Middleware para extractos bancarios Excel (.xlsx) en memoria. */
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
