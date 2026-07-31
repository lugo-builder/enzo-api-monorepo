/**
 * Supuesto: roundingMode del tarifario. Default HALF_UP a 2 decimales.
 * Documentado en docs/HYDRA-WATER-TARIFF-CALCULATOR.md
 */
export enum WaterTariffRoundingMode {
  HALF_UP = 'HALF_UP',
  HALF_EVEN = 'HALF_EVEN',
  FLOOR = 'FLOOR',
  CEIL = 'CEIL',
}
