-- Anulación de recibos (octubre 2026).
--
-- Un recibo emitido ya no se borra: si se elimina un pago que tocó cuotas con
-- recibo, esos recibos quedan anulados con fecha, motivo y quién lo hizo.
--
-- Correr en Supabase (SQL Editor) ANTES de desplegar el backend nuevo.
-- Es idempotente: se puede ejecutar más de una vez sin efecto adicional.
-- El código anterior sigue funcionando con este esquema.

BEGIN;

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS voided_at   timestamptz NULL,
  ADD COLUMN IF NOT EXISTS void_reason text NULL,
  ADD COLUMN IF NOT EXISTS voided_by   uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'receipts'::regclass AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (voided_by)%'
  ) THEN
    ALTER TABLE receipts
      ADD CONSTRAINT "FK_receipts_voided_by"
      FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
