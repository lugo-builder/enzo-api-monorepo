-- CreateTable
CREATE TABLE `recurring_charge_config` (
    `id` VARCHAR(191) NOT NULL,
    `condominiumId` VARCHAR(191) NOT NULL,
    `chargeTypeId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `currency` ENUM('MXN', 'USD') NOT NULL DEFAULT 'MXN',
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,

    INDEX `recurring_charge_config_condominiumId_chargeTypeId_status_idx`(`condominiumId`, `chargeTypeId`, `status`),
    INDEX `recurring_charge_config_effectiveFrom_effectiveTo_idx`(`effectiveFrom`, `effectiveTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `recurring_charge_config` ADD CONSTRAINT `recurring_charge_config_condominiumId_fkey` FOREIGN KEY (`condominiumId`) REFERENCES `condominium`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_charge_config` ADD CONSTRAINT `recurring_charge_config_chargeTypeId_fkey` FOREIGN KEY (`chargeTypeId`) REFERENCES `charge_type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
