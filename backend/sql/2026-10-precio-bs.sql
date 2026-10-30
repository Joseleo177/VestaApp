-- Precio distinto si se paga en bolívares (octubre 2026).
--
-- charges.bs_price: lo que cuesta la cuota (en divisas) si se paga en Bs, para
-- promociones como "200 en divisas o 220 en Bs". Null = mismo monto en ambas
-- monedas, que es lo de siempre.
--
-- Correr en Supabase (SQL Editor) ANTES de desplegar el backend nuevo.
-- Es idempotente: se puede ejecutar más de una vez sin efecto adicional.
-- El código anterior sigue funcionando con este esquema.

ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS bs_price numeric(12,2) NULL;
