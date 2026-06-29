# CondoApp — Sistema Open Source de Gestión y Pagos de Condominio

Monorepo con arquitectura de microservicios separados (Frontend · Backend · DB)
comunicados por una API RESTful.

## Stack

| Capa      | Tecnología                                              |
|-----------|---------------------------------------------------------|
| Frontend  | React + TypeScript + Vite + Tailwind (Nginx en prod)    |
| Backend   | Node.js + Express + TypeScript + TypeORM, JWT, PDFKit   |
| Base datos| PostgreSQL 16                                           |
| Storage   | Volumen Docker `condo_uploads` (comprobantes + recibos) |

## Estructura

```
condo-system/
├── backend/
│   ├── src/
│   │   ├── config/        # env + data-source (TypeORM/Postgres)
│   │   ├── controllers/   # auth, payment
│   │   ├── models/        # User, Property, Charge, Payment, Receipt
│   │   ├── routes/        # auth, payment, index
│   │   ├── services/      # payment.service, pdf.service
│   │   └── middlewares/   # auth (JWT), upload (multer), error
│   ├── uploads/           # proofs/ y receipts/ (montado como volumen)
│   ├── Dockerfile         # multi-stage
│   └── package.json
├── frontend/
│   ├── Dockerfile         # build Vite -> Nginx
│   └── nginx.conf
├── docs/DATABASE_SCHEMA.md
├── docker-compose.yml
└── .env.example
```

## Arranque rápido (Docker)

```bash
cp .env.example .env        # ajusta secretos
docker compose up --build
```

- Frontend: http://localhost:8080
- API:      http://localhost:4000/api
- Health:   http://localhost:4000/api/health

## Desarrollo del backend (sin Docker)

```bash
cd backend
npm install
npm run dev                 # ts-node-dev con recarga
```

## Endpoints clave (módulo de pagos)

| Método | Ruta                          | Rol         | Descripción                          |
|--------|-------------------------------|-------------|--------------------------------------|
| POST   | `/api/auth/login`             | público     | Login, devuelve JWT                  |
| POST   | `/api/payments`               | OWNER       | Registrar pago (multipart `proof`)   |
| GET    | `/api/payments/me`            | OWNER       | Historial de pagos propios           |
| GET    | `/api/payments/:id/receipt`   | OWNER/ADMIN | Descargar recibo PDF                 |
| GET    | `/api/payments/pending`       | ADMIN       | Cola de validación                   |
| POST   | `/api/payments/:id/confirm`   | ADMIN       | Confirmar pago + generar recibo PDF  |
| POST   | `/api/payments/:id/reject`    | ADMIN       | Rechazar pago (con motivo)           |

## Credenciales de demo (seed automático)

Al levantar el backend se siembra automáticamente (idempotente):

| Rol           | Email             | Contraseña |
|---------------|-------------------|------------|
| Administrador | admin@condo.app   | admin123   |
| Copropietario | owner@condo.app   | owner123   |

Incluye una propiedad de ejemplo (`Apt 4B`) con su alícuota del mes.

## Frontend (feature-driven)

App React + TS + Vite + Tailwind con arquitectura por features, Axios con
interceptores (JWT + 401), validación `react-hook-form` + `zod`, toasts
(`sonner`), skeleton loaders y empty states. Ver
[docs/FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md).

Desarrollo sin Docker:

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

## Pendiente (siguiente iteración)

- Migración de storage local a MinIO/S3.
- Migraciones TypeORM para producción (hoy `synchronize` solo en dev).
- ABM de propiedades/alícuotas desde la UI del admin (hoy vía API).
```
