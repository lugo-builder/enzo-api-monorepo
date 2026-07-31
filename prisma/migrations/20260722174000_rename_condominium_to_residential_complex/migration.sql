-- Rename Condominium → ResidentialComplex (table + FK columns)
-- MySQL identifier limit is 64 chars; use short mapped names where needed.

ALTER TABLE `residential_unit` DROP FOREIGN KEY `residential_unit_condominiumId_fkey`;
ALTER TABLE `water_tariff` DROP FOREIGN KEY `water_tariff_condominiumId_fkey`;
ALTER TABLE `water_billing_period` DROP FOREIGN KEY `water_billing_period_condominiumId_fkey`;
ALTER TABLE `billing_period` DROP FOREIGN KEY `billing_period_condominiumId_fkey`;
ALTER TABLE `charge_type` DROP FOREIGN KEY `charge_type_condominiumId_fkey`;
ALTER TABLE `recurring_charge_config` DROP FOREIGN KEY `recurring_charge_config_condominiumId_fkey`;
ALTER TABLE `import_batch` DROP FOREIGN KEY `import_batch_condominiumId_fkey`;
ALTER TABLE `bank_transaction` DROP FOREIGN KEY `bank_transaction_condominiumId_fkey`;

RENAME TABLE `condominium` TO `residential_complex`;

ALTER TABLE `residential_unit` RENAME INDEX `residential_unit_condominiumId_unitNumber_key` TO `residential_unit_residentialComplexId_unitNumber_key`;
ALTER TABLE `residential_unit` CHANGE `condominiumId` `residentialComplexId` VARCHAR(191) NOT NULL;
ALTER TABLE `residential_unit` ADD CONSTRAINT `residential_unit_residentialComplexId_fkey` FOREIGN KEY (`residentialComplexId`) REFERENCES `residential_complex`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `water_tariff` RENAME INDEX `water_tariff_condominiumId_status_idx` TO `water_tariff_residentialComplexId_status_idx`;
ALTER TABLE `water_tariff` CHANGE `condominiumId` `residentialComplexId` VARCHAR(191) NOT NULL;
ALTER TABLE `water_tariff` ADD CONSTRAINT `water_tariff_residentialComplexId_fkey` FOREIGN KEY (`residentialComplexId`) REFERENCES `residential_complex`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `water_billing_period` DROP INDEX `water_billing_period_condominiumId_billingYear_billingMonth_key`;
ALTER TABLE `water_billing_period` CHANGE `condominiumId` `residentialComplexId` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `wbp_complex_year_month_key` ON `water_billing_period`(`residentialComplexId`, `billingYear`, `billingMonth`);
ALTER TABLE `water_billing_period` ADD CONSTRAINT `water_billing_period_residentialComplexId_fkey` FOREIGN KEY (`residentialComplexId`) REFERENCES `residential_complex`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `billing_period` RENAME INDEX `billing_period_condominiumId_year_month_key` TO `billing_period_residentialComplexId_year_month_key`;
ALTER TABLE `billing_period` CHANGE `condominiumId` `residentialComplexId` VARCHAR(191) NOT NULL;
ALTER TABLE `billing_period` ADD CONSTRAINT `billing_period_residentialComplexId_fkey` FOREIGN KEY (`residentialComplexId`) REFERENCES `residential_complex`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `charge_type` RENAME INDEX `charge_type_condominiumId_code_key` TO `charge_type_residentialComplexId_code_key`;
ALTER TABLE `charge_type` CHANGE `condominiumId` `residentialComplexId` VARCHAR(191) NOT NULL;
ALTER TABLE `charge_type` ADD CONSTRAINT `charge_type_residentialComplexId_fkey` FOREIGN KEY (`residentialComplexId`) REFERENCES `residential_complex`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `recurring_charge_config` DROP INDEX `recurring_charge_config_condominiumId_chargeTypeId_status_idx`;
ALTER TABLE `recurring_charge_config` CHANGE `condominiumId` `residentialComplexId` VARCHAR(191) NOT NULL;
CREATE INDEX `rcc_complex_type_status_idx` ON `recurring_charge_config`(`residentialComplexId`, `chargeTypeId`, `status`);
ALTER TABLE `recurring_charge_config` ADD CONSTRAINT `recurring_charge_config_residentialComplexId_fkey` FOREIGN KEY (`residentialComplexId`) REFERENCES `residential_complex`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `import_batch` RENAME INDEX `import_batch_condominiumId_type_idx` TO `import_batch_residentialComplexId_type_idx`;
ALTER TABLE `import_batch` CHANGE `condominiumId` `residentialComplexId` VARCHAR(191) NOT NULL;
ALTER TABLE `import_batch` ADD CONSTRAINT `import_batch_residentialComplexId_fkey` FOREIGN KEY (`residentialComplexId`) REFERENCES `residential_complex`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `bank_transaction` RENAME INDEX `bank_transaction_condominiumId_status_idx` TO `bank_transaction_residentialComplexId_status_idx`;
ALTER TABLE `bank_transaction` CHANGE `condominiumId` `residentialComplexId` VARCHAR(191) NOT NULL;
ALTER TABLE `bank_transaction` ADD CONSTRAINT `bank_transaction_residentialComplexId_fkey` FOREIGN KEY (`residentialComplexId`) REFERENCES `residential_complex`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
