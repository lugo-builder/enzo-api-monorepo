-- Parámetros (ajusta valores)
SET @complexId = '7a3af30b-ae45-446e-9c6e-3715c228b13a' COLLATE utf8mb4_unicode_ci;
SET @year = 2026;
SET @month = 5;
SET SQL_SAFE_UPDATES = 0;

SET @waterPeriodId = (
SELECT id
FROM water_billing_period
WHERE residentialComplexId = @complexId
AND billingYear = @year
AND billingMonth = @month
LIMIT 1
);

SELECT @waterPeriodId AS water_period_id;

-- 1) Aplicaciones de pago
DELETE pa
FROM payment_application pa
INNER JOIN unit_charge uc ON uc.id = pa.unitChargeId
INNER JOIN water_reading wr ON wr.id = uc.waterReadingId
WHERE wr.billingPeriodId COLLATE utf8mb4_unicode_ci
= CONVERT(@waterPeriodId USING utf8mb4) COLLATE utf8mb4_unicode_ci;

-- 2) Cargos de agua
DELETE uc
FROM unit_charge uc
INNER JOIN water_reading wr ON wr.id = uc.waterReadingId
WHERE wr.billingPeriodId COLLATE utf8mb4_unicode_ci
= CONVERT(@waterPeriodId USING utf8mb4) COLLATE utf8mb4_unicode_ci;

-- 3) Lecturas
DELETE FROM water_reading
WHERE billingPeriodId COLLATE utf8mb4_unicode_ci
= CONVERT(@waterPeriodId USING utf8mb4) COLLATE utf8mb4_unicode_ci;

-- 4) Import batches
DELETE FROM import_batch
WHERE residentialComplexId COLLATE utf8mb4_unicode_ci = @complexId
AND relatedEntityType COLLATE utf8mb4_unicode_ci = 'WaterBillingPeriod'
AND relatedEntityId COLLATE utf8mb4_unicode_ci
= CONVERT(@waterPeriodId USING utf8mb4) COLLATE utf8mb4_unicode_ci;

-- 5) (Opcional) borrar el periodo
DELETE FROM water_billing_period
WHERE id COLLATE utf8mb4_unicode_ci
= CONVERT(@waterPeriodId USING utf8mb4) COLLATE utf8mb4_unicode_ci;

SET SQL_SAFE_UPDATES = 1;
