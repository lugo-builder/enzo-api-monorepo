-- AlterEnum
ALTER TABLE `water_tariff_tier` MODIFY `calculationType` ENUM('FIXED_TOTAL', 'PER_M3', 'BASE_PLUS_PER_M3', 'LOOKUP_BY_M3') NOT NULL;
