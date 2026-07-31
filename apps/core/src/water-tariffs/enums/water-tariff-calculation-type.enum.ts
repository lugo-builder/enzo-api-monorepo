export enum WaterTariffCalculationType {
  FIXED_TOTAL = 'FIXED_TOTAL',
  PER_M3 = 'PER_M3',
  BASE_PLUS_PER_M3 = 'BASE_PLUS_PER_M3',
  /** Precio total de la tabla CEA/PDF para un m³ entero (0..N). */
  LOOKUP_BY_M3 = 'LOOKUP_BY_M3',
}
