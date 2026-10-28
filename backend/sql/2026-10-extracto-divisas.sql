-- Extracto de la cuenta en divisas (octubre 2026).
--
-- Cada movimiento del extracto queda marcado con la cuenta de la que viene
-- (BS o USD) y solo casa con pagos de esa moneda. La referencia pasa a ser
-- única por cuenta: la misma puede repetirse en el extracto en Bs y en el de $.
--
-- Correr en Supabase (SQL Editor) ANTES de desplegar el backend nuevo.
-- Es idempotente: se puede ejecutar más de una vez sin efecto adicional.
-- Los movimientos ya cargados quedan como de la cuenta en Bs.

BEGIN;

ALTER TABLE bank_entries
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'BS';

-- Quitar la unicidad vieja (solo referencia), cuyo nombre lo generó TypeORM.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'bank_entries'::regclass AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (referencia)'
  LOOP
    EXECUTE format('ALTER TABLE bank_entries DROP CONSTRAINT %I', c.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'bank_entries'::regclass
      AND conname = 'UQ_bank_entries_currency_referencia'
  ) THEN
    ALTER TABLE bank_entries
      ADD CONSTRAINT "UQ_bank_entries_currency_referencia" UNIQUE (currency, referencia);
  END IF;
END $$;

COMMIT;
