-- Borrar un tarifario específico (tiers + import batch + cabecera).
-- Identifica por complejo + rateTariffDate (ej. '05-2026').
-- Si hay periodos de agua que lo referencian, primero se desvincula tariffId.

-- Parámetros (ajusta valores)
SET @complexId = '7a3af30b-ae45-446e-9c6e-3715c228b13a' COLLATE utf8mb4_unicode_ci;
SET @rateTariffDate = '05-2026' COLLATE utf8mb4_unicode_ci;
SET SQL_SAFE_UPDATES = 0;

SET @tariffId = (
  SELECT id
  FROM water_tariff
  WHERE residentialComplexId = @complexId
    AND rateTariffDate = @rateTariffDate
  LIMIT 1
);

SELECT @tariffId AS water_tariff_id;

-- 0) Desvincular periodos que usan este tarifario (FK water_billing_period.tariffId)
UPDATE water_billing_period
SET tariffId = NULL
WHERE tariffId COLLATE utf8mb4_unicode_ci
  = CONVERT(@tariffId USING utf8mb4) COLLATE utf8mb4_unicode_ci;

-- 1) Tramos / lookup (water_tariff_tier)
DELETE FROM water_tariff_tier
WHERE tariffId COLLATE utf8mb4_unicode_ci
  = CONVERT(@tariffId USING utf8mb4) COLLATE utf8mb4_unicode_ci;

-- 2) Import batches del tarifario
DELETE FROM import_batch
WHERE residentialComplexId COLLATE utf8mb4_unicode_ci = @complexId
  AND (
    (
      relatedEntityType COLLATE utf8mb4_unicode_ci = 'WaterTariff'
      AND relatedEntityId COLLATE utf8mb4_unicode_ci
        = CONVERT(@tariffId USING utf8mb4) COLLATE utf8mb4_unicode_ci
    )
    OR (
      type = 'WATER_TARIFF'
      AND relatedEntityId COLLATE utf8mb4_unicode_ci
        = CONVERT(@tariffId USING utf8mb4) COLLATE utf8mb4_unicode_ci
    )
  );

-- 3) Cabecera del tarifario
DELETE FROM water_tariff
WHERE id COLLATE utf8mb4_unicode_ci
  = CONVERT(@tariffId USING utf8mb4) COLLATE utf8mb4_unicode_ci;

SET SQL_SAFE_UPDATES = 1;
