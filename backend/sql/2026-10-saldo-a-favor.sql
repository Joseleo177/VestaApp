-- Saldo a favor utilizable (octubre 2026).
--
-- 1. payments.from_credit: el vecino (o la junta directiva) paga cuotas con su
--    saldo a favor. Queda como un pago confirmado más —con sus aplicaciones y
--    su recibo— marcado para no contarlo como dinero cobrado ni buscarlo en el
--    extracto, y para devolverlo al saldo si se elimina.
-- 2. credit_adjustments: cada corrección manual del saldo a favor de un titular,
--    con el monto, el saldo resultante, el motivo y quién la hizo.
--
-- Correr en Supabase (SQL Editor) ANTES de desplegar el backend nuevo.
-- Es idempotente: se puede ejecutar más de una vez sin efecto adicional.
-- El código anterior sigue funcionando con este esquema.

BEGIN;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS from_credit boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS credit_adjustments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  amount        numeric(12,2) NOT NULL,
  balance_after numeric(12,2) NOT NULL,
  reason        text NOT NULL,
  created_by    uuid NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "FK_credit_adjustments_user"
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT "FK_credit_adjustments_created_by"
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "IDX_credit_adjustments_user" ON credit_adjustments (user_id);

COMMIT;
