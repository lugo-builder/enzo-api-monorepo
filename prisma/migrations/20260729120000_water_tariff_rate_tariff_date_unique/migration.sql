-- Clave de vigencia CEA (MM-YYYY) para upsert sin duplicar tarifarios.
ALTER TABLE `water_tariff`
  ADD COLUMN `rateTariffDate` VARCHAR(7) NULL;

-- Backfill desde nombre "Tarifa MM-YYYY"
UPDATE `water_tariff`
SET `rateTariffDate` = TRIM(SUBSTRING(`name`, 8))
WHERE `name` REGEXP '^Tarifa [0-1][0-9]-[0-9]{4}$';

-- Backfill desde effectiveFrom para lookups CEA sin nombre estándar
UPDATE `water_tariff`
SET `rateTariffDate` = DATE_FORMAT(`effectiveFrom`, '%m-%Y')
WHERE `rateTariffDate` IS NULL
  AND (`notes` LIKE '%Lookup table imported from CEA%' OR `notes` LIKE '%LOOKUP_BY_M3%' OR `notes` LIKE '%CEA PDF%');

-- Conservar un registro por (complejo, vigencia); archivar y limpiar clave en el resto
UPDATE `water_tariff` wt
INNER JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (
      PARTITION BY `residentialComplexId`, `rateTariffDate`
      ORDER BY
        CASE WHEN `status` = 'ACTIVE' THEN 0 ELSE 1 END,
        `createdAt` DESC
    ) AS `rn`
  FROM `water_tariff`
  WHERE `rateTariffDate` IS NOT NULL
) ranked ON ranked.`id` = wt.`id`
SET
  wt.`status` = 'ARCHIVED',
  wt.`rateTariffDate` = NULL
WHERE ranked.`rn` > 1;

CREATE UNIQUE INDEX `wt_complex_rate_date_key`
  ON `water_tariff`(`residentialComplexId`, `rateTariffDate`);
