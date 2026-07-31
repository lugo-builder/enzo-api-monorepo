-- ImportBatchType: nuevos tipos de documento JSON
ALTER TABLE `import_batch`
  MODIFY COLUMN `type` ENUM(
    'WATER_READINGS',
    'WATER_TARIFF',
    'WATER_CONSUMPTION_REPORT',
    'PAYMENT_REPORT',
    'BANK_TRANSACTIONS',
    'RESIDENTS',
    'OPENING_BALANCES',
    'CHARGES'
  ) NOT NULL;

-- ImportBatch: payload JSON tipado + vínculo a entidad canónica
ALTER TABLE `import_batch`
  ADD COLUMN `payload` JSON NULL,
  ADD COLUMN `relatedEntityType` VARCHAR(191) NULL,
  ADD COLUMN `relatedEntityId` VARCHAR(191) NULL;

CREATE INDEX `import_batch_relatedEntityType_relatedEntityId_idx`
  ON `import_batch`(`relatedEntityType`, `relatedEntityId`);

-- WaterTariffTier: fromM3/toM3 → m3 (lookup CEA)
ALTER TABLE `water_tariff_tier`
  ADD COLUMN `m3` DECIMAL(14, 4) NOT NULL DEFAULT 0;

UPDATE `water_tariff_tier` SET `m3` = `fromM3`;

ALTER TABLE `water_tariff_tier`
  DROP COLUMN `fromM3`,
  DROP COLUMN `toM3`;

CREATE UNIQUE INDEX `wtt_tariff_m3_key` ON `water_tariff_tier`(`tariffId`, `m3`);
