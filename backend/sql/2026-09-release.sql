-- Versión de septiembre 2026:
--   1-3. Multimoneda: tasas BCV en USD y EUR, moneda de cobro por cuota.
--   4.   Condonación del saldo de cuotas con abono parcial.
--   5.   Pagos que cubren varias cuotas (un pago = un recibo).
--
-- Correr en Supabase (SQL Editor) ANTES de desplegar el backend nuevo.
-- Es idempotente: se puede ejecutar más de una vez sin efecto adicional.
-- El código anterior sigue funcionando con este esquema, así que no hay
-- ventana rota entre correr el script y desplegar.

BEGIN;

-- 1. Tasas: una fila por día y moneda. Las existentes son todas EUR.
ALTER TABLE exchange_rate_records
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'EUR';

-- La unicidad pasa de (date) a (date, currency). El nombre de la restricción
-- vieja lo generó TypeORM, así que se busca por su definición.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'exchange_rate_records'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (date)'
  LOOP
    EXECUTE format('ALTER TABLE exchange_rate_records DROP CONSTRAINT %I', c.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'exchange_rate_records'::regclass
      AND conname = 'UQ_exchange_rate_date_currency'
  ) THEN
    ALTER TABLE exchange_rate_records
      ADD CONSTRAINT "UQ_exchange_rate_date_currency" UNIQUE (date, currency);
  END IF;
END $$;

-- 2. Cuotas: moneda de la tasa con que se convierten a Bs. Todas las
--    existentes quedan en EUR; las especiales que se cobraron a tasa dólar se
--    corrigen desde el panel (Cuotas → período → cambiar tasa).
ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'EUR';

-- 3. Pagos: moneda de la tasa congelada y lo que dejaron en saldo a favor.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS rate_currency varchar(3) NULL,
  ADD COLUMN IF NOT EXISTS credit_amount numeric(12,2) NULL;

-- Todos los pagos en Bs anteriores se hicieron a tasa euro.
UPDATE payments
   SET rate_currency = 'EUR'
 WHERE currency = 'BS' AND exchange_rate IS NOT NULL AND rate_currency IS NULL;

-- 4. Condonación: saldo perdonado al cerrar una cuota parcial, con su motivo.
ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS write_off_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS write_off_reason text NULL,
  ADD COLUMN IF NOT EXISTS written_off_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS written_off_by uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'charges'::regclass AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (written_off_by)%'
  ) THEN
    ALTER TABLE charges
      ADD CONSTRAINT "FK_charges_written_off_by"
      FOREIGN KEY (written_off_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Pagos de varias cuotas: cuáles eligió el vecino y en qué orden.
CREATE TABLE IF NOT EXISTS payment_targets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  charge_id  uuid NOT NULL REFERENCES charges(id)  ON DELETE CASCADE,
  position   int  NOT NULL,
  CONSTRAINT "UQ_payment_targets_payment_charge" UNIQUE (payment_id, charge_id)
);
CREATE INDEX IF NOT EXISTS "IDX_payment_targets_charge" ON payment_targets (charge_id);

COMMIT;
