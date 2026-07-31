-- WaterBillingPeriod: datos del recibo CEA / macromedidor por periodo
ALTER TABLE `water_billing_period`
  ADD COLUMN `ceaBillTotalCost` DECIMAL(14, 2) NULL,
  ADD COLUMN `macrometerM3FromBill` DECIMAL(14, 4) NULL,
  ADD COLUMN `physicalMacrometerM3` DECIMAL(14, 4) NULL;
