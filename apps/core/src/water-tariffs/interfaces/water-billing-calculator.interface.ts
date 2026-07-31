import { WaterTariffCalculationType } from '../enums/water-tariff-calculation-type.enum';
import { WaterTariffRoundingMode } from '../enums/water-tariff-rounding-mode.enum';

/** Valores monetarios / m³ como string decimal para evitar float. */
export type DecimalString = string;

export interface WaterTariffTierInput {
  id?: string;
  /** Clave de lookup (m³ enteros: 0, 1, 2, …). */
  m3: DecimalString;
  fixedAmount?: DecimalString;
  amountPerM3?: DecimalString;
  calculationType: WaterTariffCalculationType;
  sortOrder: number;
}

export interface WaterTariffInput {
  id?: string;
  baseCharge?: DecimalString;
  minimumConsumptionM3?: DecimalString;
  discountAmount?: DecimalString;
  discountPercentage?: DecimalString;
  roundingMode?: WaterTariffRoundingMode;
  tiers: WaterTariffTierInput[];
}

export interface WaterCalculationInput {
  /** Consumo bruto (current - previous). */
  consumptionM3: DecimalString;
  /** Diferencia del macromedidor en MXN; se suma al total, no al consumo. */
  macroDifferencePrice?: DecimalString;
  manualAdjustment?: DecimalString;
  reserveFund?: DecimalString;
}

export interface AppliedTierResult {
  tierId?: string;
  m3: DecimalString;
  calculationType: WaterTariffCalculationType;
  amount: DecimalString;
}

export interface WaterCalculationResult {
  consumption: DecimalString;
  adjustedConsumption: DecimalString;
  billingConsumption: DecimalString;
  baseCharge: DecimalString;
  tierAmount: DecimalString;
  discount: DecimalString;
  /** Monto MXN del macromedidor aplicado al total. */
  macroAdjustment: DecimalString;
  manualAdjustment: DecimalString;
  reserveFund: DecimalString;
  total: DecimalString;
  appliedTier: AppliedTierResult[];
}
