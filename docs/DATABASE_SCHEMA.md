# Esquema Conceptual de la Base de Datos — CondoApp

Base de datos relacional **PostgreSQL**. Cuatro entidades centrales más una
opcional de cargos mensuales (alícuotas) que conecta deudas con pagos.

## Diagrama Entidad-Relación

```
┌─────────────────────┐          ┌──────────────────────┐
│       users         │          │     properties       │
├─────────────────────┤          ├──────────────────────┤
│ id (PK)             │ 1      * │ id (PK)              │
│ email (UQ)          │──────────│ owner_id (FK)        │
│ password_hash       │          │ code (UQ)  "Apt 4B"  │
│ full_name           │          │ tower / block        │
│ phone               │          │ aliquot_percentage   │
│ role  [ADMIN|OWNER] │          │ created_at           │
│ is_active           │          └──────────┬───────────┘
│ created_at          │                     │ 1
└──────────┬──────────┘                     │
           │                                │ *
           │              ┌─────────────────▼──────────────┐
           │              │            charges             │
           │              │  (alícuota/deuda mensual)      │
           │              ├────────────────────────────────┤
           │              │ id (PK)                        │
           │              │ property_id (FK)               │
           │              │ period   "2026-06"             │
           │              │ description                    │
           │              │ amount                         │
           │              │ due_date                       │
           │              │ status  [PENDING|PARTIAL|PAID] │
           │              │ created_at                     │
           │              └─────────────┬──────────────────┘
           │                            │ 1
           │ 1                          │ *
           │                ┌───────────▼─────────────────────────┐
           │ *              │              payments               │
           └────────────────┤─────────────────────────────────────┤
   (registra / revisa)      │ id (PK)                             │
                            │ property_id (FK -> properties)      │
                            │ submitted_by (FK -> users)          │
                            │ charge_id (FK -> charges, NULLABLE) │
                            │ amount                              │
                            │ bank                                │
                            │ reference                           │
                            │ payment_date                        │
                            │ proof_file_path  (comprobante)      │
                            │ status [PENDING|CONFIRMED|REJECTED] │
                            │ reviewed_by (FK -> users, NULLABLE) │
                            │ reviewed_at                         │
                            │ reject_reason                       │
                            │ created_at                          │
                            └───────────────┬─────────────────────┘
                                            │ 1
                                            │ 0..1
                                ┌───────────▼──────────────┐
                                │         receipts         │
                                ├──────────────────────────┤
                                │ id (PK)                  │
                                │ payment_id (FK, UQ)      │
                                │ receipt_number (UQ)      │
                                │ pdf_file_path            │
                                │ issued_by (FK -> users)  │
                                │ issued_at                │
                                └──────────────────────────┘
```

## Tablas

### `users`
Copropietarios y administradores. El `role` controla qué panel ve el usuario y
qué endpoints puede consumir (middleware de roles).

| Campo          | Tipo           | Notas                                  |
|----------------|----------------|----------------------------------------|
| id             | uuid PK        | generado                               |
| email          | varchar UQ     | login                                  |
| password_hash  | varchar        | bcrypt                                 |
| full_name      | varchar        |                                        |
| phone          | varchar null   |                                        |
| role           | enum           | `ADMIN` \| `OWNER`                      |
| is_active      | boolean        | default true                           |
| created_at     | timestamptz    |                                        |

### `properties`
Unidades del condominio (apartamentos/locales). Cada una pertenece a un
copropietario (`owner_id`). El `aliquot_percentage` define su cuota relativa.

| Campo               | Tipo         | Notas                              |
|---------------------|--------------|------------------------------------|
| id                  | uuid PK      |                                    |
| owner_id            | uuid FK      | -> users.id                        |
| code                | varchar UQ   | identificador "Apt 4B"             |
| tower               | varchar null | torre/bloque                       |
| aliquot_percentage  | numeric(5,2) | % de la alícuota                   |
| created_at          | timestamptz  |                                    |

### `charges` (alícuota / deuda mensual)
Cargo que el **administrador** emite cada mes por propiedad. Es la "deuda" que
el copropietario debe pagar. Un pago puede asociarse a un cargo concreto.

| Campo        | Tipo          | Notas                                   |
|--------------|---------------|-----------------------------------------|
| id           | uuid PK       |                                         |
| property_id  | uuid FK       | -> properties.id                        |
| period       | varchar(7)    | `YYYY-MM`                               |
| description  | varchar       | "Alícuota junio 2026"                   |
| amount       | numeric(12,2) |                                         |
| due_date     | date          |                                         |
| status       | enum          | `PENDING` \| `PARTIAL` \| `PAID`        |
| created_at   | timestamptz   |                                         |

### `payments`
Pago registrado por el copropietario con su comprobante adjunto. El admin lo
confirma o rechaza. Es el corazón del flujo.

| Campo            | Tipo          | Notas                                       |
|------------------|---------------|---------------------------------------------|
| id               | uuid PK       |                                             |
| property_id      | uuid FK       | -> properties.id                            |
| submitted_by     | uuid FK       | -> users.id (copropietario)                 |
| charge_id        | uuid FK null  | -> charges.id (cargo que salda, opcional)   |
| amount           | numeric(12,2) |                                             |
| bank             | varchar       | banco emisor                                |
| reference        | varchar       | nº de referencia de la transacción          |
| payment_date     | date          | fecha de la transacción                     |
| proof_file_path  | varchar       | ruta del comprobante en /uploads            |
| status           | enum          | `PENDING` \| `CONFIRMED` \| `REJECTED`      |
| reviewed_by      | uuid FK null  | -> users.id (admin que revisó)              |
| reviewed_at      | timestamptz   |                                             |
| reject_reason    | varchar null  | motivo si fue rechazado                     |
| created_at       | timestamptz   |                                             |

### `receipts`
Recibo PDF generado **solo** cuando un pago pasa a `CONFIRMED`. Relación 1:1
con `payments`.

| Campo           | Tipo        | Notas                                  |
|-----------------|-------------|----------------------------------------|
| id              | uuid PK     |                                        |
| payment_id      | uuid FK UQ  | -> payments.id (único)                 |
| receipt_number  | varchar UQ  | correlativo legible "REC-2026-000123"  |
| pdf_file_path   | varchar     | ruta del PDF en /uploads/receipts      |
| issued_by       | uuid FK     | -> users.id (admin)                    |
| issued_at       | timestamptz |                                        |

## Relaciones (resumen)
- `users (1) ──< (N) properties` — un copropietario posee N unidades.
- `properties (1) ──< (N) charges` — N alícuotas mensuales por unidad.
- `properties (1) ──< (N) payments` — N pagos por unidad.
- `users (1) ──< (N) payments` (submitted_by) — pagos que registró.
- `charges (1) ──< (N) payments` — un cargo puede saldarse con uno o más pagos.
- `payments (1) ── (0..1) receipts` — un recibo por pago confirmado.
