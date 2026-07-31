-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `phone` VARCHAR(191) NULL,
    `passwordRegistered` VARCHAR(191) NULL,
    `company` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'INACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `deactivatedAt` DATETIME(3) NULL,

    UNIQUE INDEX `user_id_key`(`id`),
    UNIQUE INDEX `user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_details` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `sendNotifications` BOOLEAN NOT NULL DEFAULT false,
    `receiveNotifications` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NULL,

    UNIQUE INDEX `user_details_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rol` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `rol_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permission` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rol_permission` (
    `id` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,

    UNIQUE INDEX `rol_permission_roleId_permissionId_key`(`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `condominium` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NULL,
    `taxId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `currency` ENUM('MXN', 'USD') NOT NULL DEFAULT 'MXN',
    `paymentDueDay` INTEGER NOT NULL DEFAULT 10,
    `totalUnits` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `bankName` VARCHAR(191) NULL,
    `bankAccountMasked` VARCHAR(191) NULL,
    `bankClabeMasked` VARCHAR(191) NULL,
    `bankBeneficiary` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `residential_unit` (
    `id` VARCHAR(191) NOT NULL,
    `condominiumId` VARCHAR(191) NOT NULL,
    `unitNumber` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'VACANT', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `serviceStatus` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `residential_unit_condominiumId_unitNumber_key`(`condominiumId`, `unitNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resident` (
    `id` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `secondaryPhone` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_resident` (
    `id` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `residentId` VARCHAR(191) NOT NULL,
    `relationshipType` ENUM('OWNER', 'TENANT', 'FAMILY_MEMBER', 'AUTHORIZED_PERSON', 'OTHER') NOT NULL DEFAULT 'OWNER',
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `isPaymentResponsible` BOOLEAN NOT NULL DEFAULT false,
    `startDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endDate` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'ENDED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,

    INDEX `unit_resident_unitId_status_idx`(`unitId`, `status`),
    INDEX `unit_resident_residentId_idx`(`residentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `water_meter` (
    `id` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `serialNumber` VARCHAR(191) NOT NULL,
    `installationDate` DATETIME(3) NULL,
    `removalDate` DATETIME(3) NULL,
    `initialReading` DECIMAL(14, 4) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE', 'REPLACED', 'DAMAGED', 'MISSING') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `water_meter_serialNumber_idx`(`serialNumber`),
    INDEX `water_meter_unitId_status_idx`(`unitId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `water_tariff` (
    `id` VARCHAR(191) NOT NULL,
    `condominiumId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `baseCharge` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `minimumConsumptionM3` DECIMAL(14, 4) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `discountPercentage` DECIMAL(8, 4) NOT NULL DEFAULT 0,
    `roundingMode` ENUM('HALF_UP', 'HALF_EVEN', 'FLOOR', 'CEIL') NOT NULL DEFAULT 'HALF_UP',
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,

    INDEX `water_tariff_condominiumId_status_idx`(`condominiumId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `water_tariff_tier` (
    `id` VARCHAR(191) NOT NULL,
    `tariffId` VARCHAR(191) NOT NULL,
    `fromM3` DECIMAL(14, 4) NOT NULL,
    `toM3` DECIMAL(14, 4) NULL,
    `fixedAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `amountPerM3` DECIMAL(14, 4) NOT NULL DEFAULT 0,
    `calculationType` ENUM('FIXED_TOTAL', 'PER_M3', 'BASE_PLUS_PER_M3') NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,

    INDEX `water_tariff_tier_tariffId_sortOrder_idx`(`tariffId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `water_billing_period` (
    `id` VARCHAR(191) NOT NULL,
    `condominiumId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `readingStartDate` DATETIME(3) NULL,
    `readingEndDate` DATETIME(3) NULL,
    `billingYear` INTEGER NOT NULL,
    `billingMonth` INTEGER NOT NULL,
    `tariffId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'OPEN', 'CALCULATED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `notes` TEXT NULL,
    `closedAt` DATETIME(3) NULL,
    `closedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `water_billing_period_condominiumId_billingYear_billingMonth_key`(`condominiumId`, `billingYear`, `billingMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `water_reading` (
    `id` VARCHAR(191) NOT NULL,
    `billingPeriodId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `waterMeterId` VARCHAR(191) NULL,
    `previousReading` DECIMAL(14, 4) NOT NULL DEFAULT 0,
    `currentReading` DECIMAL(14, 4) NOT NULL DEFAULT 0,
    `consumptionM3` DECIMAL(14, 4) NOT NULL DEFAULT 0,
    `macroDifferenceM3` DECIMAL(14, 4) NOT NULL DEFAULT 0,
    `adjustedConsumptionM3` DECIMAL(14, 4) NOT NULL DEFAULT 0,
    `baseAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `calculatedAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `manualAdjustment` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `finalAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `isDelinquent` BOOLEAN NOT NULL DEFAULT false,
    `reserveFundAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `calculationMode` ENUM('ACTUAL', 'ESTIMATED', 'MANUAL', 'METER_REPLACEMENT') NOT NULL DEFAULT 'ACTUAL',
    `notes` TEXT NULL,
    `status` ENUM('DRAFT', 'CAPTURED', 'CALCULATED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `water_reading_billingPeriodId_unitId_key`(`billingPeriodId`, `unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_period` (
    `id` VARCHAR(191) NOT NULL,
    `condominiumId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'GENERATED', 'OPEN', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `generatedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `billing_period_condominiumId_year_month_key`(`condominiumId`, `year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `charge_type` (
    `id` VARCHAR(191) NOT NULL,
    `condominiumId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('ORDINARY_FEE', 'WATER', 'PENALTY', 'PARKING', 'PAST_DUE', 'EXTRAORDINARY_FEE', 'RESERVE_FUND', 'SURCHARGE', 'DISCOUNT', 'ADJUSTMENT', 'OTHER', 'OPENING_BALANCE') NOT NULL,
    `defaultAmount` DECIMAL(14, 2) NULL,
    `isRecurring` BOOLEAN NOT NULL DEFAULT false,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `affectsBalance` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `charge_type_condominiumId_code_key`(`condominiumId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_charge` (
    `id` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `billingPeriodId` VARCHAR(191) NULL,
    `chargeTypeId` VARCHAR(191) NOT NULL,
    `waterReadingId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `currency` ENUM('MXN', 'USD') NOT NULL DEFAULT 'MXN',
    `movementType` ENUM('DEBIT', 'CREDIT') NOT NULL DEFAULT 'DEBIT',
    `chargeDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueDate` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'WAIVED') NOT NULL DEFAULT 'PENDING',
    `source` ENUM('MANUAL', 'WATER_READING', 'RECURRING_FEE', 'PENALTY', 'IMPORT', 'SYSTEM') NOT NULL DEFAULT 'MANUAL',
    `externalReference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `cancellationReason` TEXT NULL,

    INDEX `unit_charge_unitId_status_idx`(`unitId`, `status`),
    INDEX `unit_charge_billingPeriodId_idx`(`billingPeriodId`),
    INDEX `unit_charge_externalReference_idx`(`externalReference`),
    UNIQUE INDEX `unit_charge_waterReadingId_key`(`waterReadingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_batch` (
    `id` VARCHAR(191) NOT NULL,
    `condominiumId` VARCHAR(191) NOT NULL,
    `type` ENUM('WATER_READINGS', 'BANK_TRANSACTIONS', 'RESIDENTS', 'OPENING_BALANCES', 'CHARGES') NOT NULL,
    `filename` VARCHAR(191) NULL,
    `checksum` VARCHAR(191) NULL,
    `status` ENUM('UPLOADED', 'VALIDATING', 'VALIDATED', 'PROCESSING', 'PROCESSED', 'PARTIAL', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'UPLOADED',
    `totalRows` INTEGER NOT NULL DEFAULT 0,
    `validRows` INTEGER NOT NULL DEFAULT 0,
    `invalidRows` INTEGER NOT NULL DEFAULT 0,
    `processedRows` INTEGER NOT NULL DEFAULT 0,
    `errorReport` JSON NULL,
    `previewData` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `processedAt` DATETIME(3) NULL,

    INDEX `import_batch_condominiumId_type_idx`(`condominiumId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_transaction` (
    `id` VARCHAR(191) NOT NULL,
    `condominiumId` VARCHAR(191) NOT NULL,
    `transactionDate` DATETIME(3) NOT NULL,
    `postingDate` DATETIME(3) NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `currency` ENUM('MXN', 'USD') NOT NULL DEFAULT 'MXN',
    `transactionType` ENUM('CREDIT', 'DEBIT') NOT NULL DEFAULT 'CREDIT',
    `bankReference` VARCHAR(191) NULL,
    `concept` VARCHAR(191) NULL,
    `senderName` VARCHAR(191) NULL,
    `senderAccountMasked` VARCHAR(191) NULL,
    `rawDescription` TEXT NULL,
    `source` ENUM('MANUAL', 'CSV', 'XLSX', 'BANK_STATEMENT', 'API') NOT NULL DEFAULT 'MANUAL',
    `importBatchId` VARCHAR(191) NULL,
    `sourceHash` VARCHAR(191) NULL,
    `status` ENUM('UNMATCHED', 'SUGGESTED', 'PARTIALLY_APPLIED', 'APPLIED', 'IGNORED', 'DUPLICATE', 'REVERSED') NOT NULL DEFAULT 'UNMATCHED',
    `matchedUnitId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,

    INDEX `bank_transaction_condominiumId_status_idx`(`condominiumId`, `status`),
    INDEX `bank_transaction_sourceHash_idx`(`sourceHash`),
    INDEX `bank_transaction_bankReference_idx`(`bankReference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment` (
    `id` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `bankTransactionId` VARCHAR(191) NULL,
    `paymentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `amount` DECIMAL(14, 2) NOT NULL,
    `currency` ENUM('MXN', 'USD') NOT NULL DEFAULT 'MXN',
    `paymentMethod` ENUM('BANK_TRANSFER', 'CASH', 'DEPOSIT', 'CHECK', 'OTHER') NOT NULL DEFAULT 'BANK_TRANSFER',
    `reference` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'PARTIALLY_APPLIED', 'APPLIED', 'CANCELLED', 'REVERSED') NOT NULL DEFAULT 'PENDING',
    `unappliedAmount` DECIMAL(14, 2) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `cancellationReason` TEXT NULL,

    INDEX `payment_unitId_status_idx`(`unitId`, `status`),
    INDEX `payment_bankTransactionId_idx`(`bankTransactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_application` (
    `id` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `unitChargeId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `reversedAt` DATETIME(3) NULL,
    `reversedBy` VARCHAR(191) NULL,
    `reversalReason` TEXT NULL,

    UNIQUE INDEX `payment_application_paymentId_unitChargeId_key`(`paymentId`, `unitChargeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_statement_snapshot` (
    `id` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `billingPeriodId` VARCHAR(191) NOT NULL,
    `openingBalance` DECIMAL(14, 2) NOT NULL,
    `periodCharges` DECIMAL(14, 2) NOT NULL,
    `periodCredits` DECIMAL(14, 2) NOT NULL,
    `periodPayments` DECIMAL(14, 2) NOT NULL,
    `closingBalance` DECIMAL(14, 2) NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `generatedBy` VARCHAR(191) NULL,
    `dataHash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `account_statement_snapshot_unitId_billingPeriodId_key`(`unitId`, `billingPeriodId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `previousData` JSON NULL,
    `newData` JSON NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_log_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `audit_log_userId_idx`(`userId`),
    INDEX `audit_log_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `rol`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_details` ADD CONSTRAINT `user_details_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rol_permission` ADD CONSTRAINT `rol_permission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `rol`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rol_permission` ADD CONSTRAINT `rol_permission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permission`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `residential_unit` ADD CONSTRAINT `residential_unit_condominiumId_fkey` FOREIGN KEY (`condominiumId`) REFERENCES `condominium`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_resident` ADD CONSTRAINT `unit_resident_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `residential_unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_resident` ADD CONSTRAINT `unit_resident_residentId_fkey` FOREIGN KEY (`residentId`) REFERENCES `resident`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_meter` ADD CONSTRAINT `water_meter_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `residential_unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_tariff` ADD CONSTRAINT `water_tariff_condominiumId_fkey` FOREIGN KEY (`condominiumId`) REFERENCES `condominium`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_tariff_tier` ADD CONSTRAINT `water_tariff_tier_tariffId_fkey` FOREIGN KEY (`tariffId`) REFERENCES `water_tariff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_billing_period` ADD CONSTRAINT `water_billing_period_condominiumId_fkey` FOREIGN KEY (`condominiumId`) REFERENCES `condominium`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_billing_period` ADD CONSTRAINT `water_billing_period_tariffId_fkey` FOREIGN KEY (`tariffId`) REFERENCES `water_tariff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_reading` ADD CONSTRAINT `water_reading_billingPeriodId_fkey` FOREIGN KEY (`billingPeriodId`) REFERENCES `water_billing_period`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_reading` ADD CONSTRAINT `water_reading_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `residential_unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_reading` ADD CONSTRAINT `water_reading_waterMeterId_fkey` FOREIGN KEY (`waterMeterId`) REFERENCES `water_meter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_period` ADD CONSTRAINT `billing_period_condominiumId_fkey` FOREIGN KEY (`condominiumId`) REFERENCES `condominium`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `charge_type` ADD CONSTRAINT `charge_type_condominiumId_fkey` FOREIGN KEY (`condominiumId`) REFERENCES `condominium`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_charge` ADD CONSTRAINT `unit_charge_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `residential_unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_charge` ADD CONSTRAINT `unit_charge_billingPeriodId_fkey` FOREIGN KEY (`billingPeriodId`) REFERENCES `billing_period`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_charge` ADD CONSTRAINT `unit_charge_chargeTypeId_fkey` FOREIGN KEY (`chargeTypeId`) REFERENCES `charge_type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_charge` ADD CONSTRAINT `unit_charge_waterReadingId_fkey` FOREIGN KEY (`waterReadingId`) REFERENCES `water_reading`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_batch` ADD CONSTRAINT `import_batch_condominiumId_fkey` FOREIGN KEY (`condominiumId`) REFERENCES `condominium`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_transaction` ADD CONSTRAINT `bank_transaction_condominiumId_fkey` FOREIGN KEY (`condominiumId`) REFERENCES `condominium`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_transaction` ADD CONSTRAINT `bank_transaction_importBatchId_fkey` FOREIGN KEY (`importBatchId`) REFERENCES `import_batch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_transaction` ADD CONSTRAINT `bank_transaction_matchedUnitId_fkey` FOREIGN KEY (`matchedUnitId`) REFERENCES `residential_unit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `residential_unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_bankTransactionId_fkey` FOREIGN KEY (`bankTransactionId`) REFERENCES `bank_transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_application` ADD CONSTRAINT `payment_application_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_application` ADD CONSTRAINT `payment_application_unitChargeId_fkey` FOREIGN KEY (`unitChargeId`) REFERENCES `unit_charge`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_statement_snapshot` ADD CONSTRAINT `account_statement_snapshot_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `residential_unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_statement_snapshot` ADD CONSTRAINT `account_statement_snapshot_billingPeriodId_fkey` FOREIGN KEY (`billingPeriodId`) REFERENCES `billing_period`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
