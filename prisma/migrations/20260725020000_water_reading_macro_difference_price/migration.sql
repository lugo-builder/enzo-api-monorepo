-- Macro-meter difference is a MXN amount, not m³.
ALTER TABLE `water_reading` CHANGE `macroDifferenceM3` `macroDifferencePrice` DECIMAL(14, 2) NOT NULL DEFAULT 0;
