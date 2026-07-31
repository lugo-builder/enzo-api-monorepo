import { BadRequestException, Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import { WaterTariffCalculationType } from './enums/water-tariff-calculation-type.enum';
import { WaterTariffRoundingMode } from './enums/water-tariff-rounding-mode.enum';
import {
  AppliedTierResult,
  DecimalString,
  WaterCalculationInput,
  WaterCalculationResult,
  WaterTariffInput,
  WaterTariffTierInput,
} from './interfaces/water-billing-calculator.interface';

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);
const MONEY_PLACES = 2;
const M3_PLACES = 4;

/**
 * Motor de cálculo por tabla lookup (CEA/PDF):
 * floor(consumo) → fila m3 → fixedAmount.
 *
 * Supuestos: docs/HYDRA-WATER-TARIFF-CALCULATOR.md
 */
@Injectable()
export class WaterBillingCalculatorService {
  calculate(
    input: WaterCalculationInput,
    tariff: WaterTariffInput,
  ): WaterCalculationResult {
    const consumption = this.toDecimal(input.consumptionM3, 'consumptionM3');
    const macroAdjustment = this.toDecimal(
      input.macroDifferencePrice ?? '0',
      'macroDifferencePrice',
    );
    const manualAdjustment = this.toDecimal(
      input.manualAdjustment ?? '0',
      'manualAdjustment',
    );
    const reserveFund = this.toDecimal(input.reserveFund ?? '0', 'reserveFund');

    if (consumption.lt(ZERO)) {
      throw new BadRequestException(
        'consumption cannot be negative without a documented adjustment flow',
      );
    }

    const minimum = this.toDecimal(
      tariff.minimumConsumptionM3 ?? '0',
      'minimumConsumptionM3',
    );
    const billingConsumption = Decimal.max(consumption, minimum);
    const baseCharge = this.toDecimal(tariff.baseCharge ?? '0', 'baseCharge');
    const tiers = [...(tariff.tiers ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    if (!tiers.length) {
      throw new BadRequestException('Tariff has no m3 rows configured');
    }

    const lookup = this.calculateLookupAmount(billingConsumption, tiers);
    const tierAmount = lookup.amount;
    const appliedTier: AppliedTierResult[] = [lookup.applied];

    const subtotal = baseCharge.plus(tierAmount);
    const discount = this.computeDiscount(subtotal, tariff);
    const roundingMode =
      tariff.roundingMode ?? WaterTariffRoundingMode.HALF_UP;

    const calculatedAmount = this.roundDecimal(
      subtotal.minus(discount),
      MONEY_PLACES,
      roundingMode,
    );
    const total = this.roundDecimal(
      calculatedAmount
        .plus(macroAdjustment)
        .plus(manualAdjustment)
        .plus(reserveFund),
      MONEY_PLACES,
      roundingMode,
    );

    return {
      consumption: this.formatM3(consumption),
      adjustedConsumption: this.formatM3(consumption),
      billingConsumption: this.formatM3(billingConsumption),
      baseCharge: this.formatMoney(baseCharge),
      tierAmount: this.formatMoney(
        this.roundDecimal(tierAmount, MONEY_PLACES, roundingMode),
      ),
      discount: this.formatMoney(
        this.roundDecimal(discount, MONEY_PLACES, roundingMode),
      ),
      macroAdjustment: this.formatMoney(macroAdjustment),
      manualAdjustment: this.formatMoney(manualAdjustment),
      reserveFund: this.formatMoney(reserveFund),
      total: this.formatMoney(total),
      appliedTier,
    };
  }

  /**
   * Hydra 1 consumió 5 m³ → floor(5) → fila m3=5 → fixedAmount.
   * Fracciones: 5.7 → 5. Fuera de tabla → error.
   */
  private calculateLookupAmount(
    billingConsumption: Decimal,
    tiers: WaterTariffTierInput[],
  ): { amount: Decimal; applied: AppliedTierResult } {
    const lookupKey = billingConsumption.toDecimalPlaces(0, Decimal.ROUND_FLOOR);
    if (lookupKey.lt(ZERO)) {
      throw new BadRequestException('Lookup m3 cannot be negative');
    }

    const byM3 = new Map<string, WaterTariffTierInput>();
    let maxM3 = ZERO;
    for (const tier of tiers) {
      const key = this.toDecimal(tier.m3, 'm3').toDecimalPlaces(
        0,
        Decimal.ROUND_FLOOR,
      );
      const keyStr = key.toFixed(0);
      if (byM3.has(keyStr)) {
        throw new BadRequestException(`Duplicate tariff row for m3=${keyStr}`);
      }
      byM3.set(keyStr, tier);
      if (key.gt(maxM3)) {
        maxM3 = key;
      }
    }

    const keyStr = lookupKey.toFixed(0);
    const tier = byM3.get(keyStr);
    if (!tier) {
      throw new BadRequestException(
        `No tariff row for ${keyStr} m³ (table covers 0..${maxM3.toFixed(0)}). ` +
          'Import the full CEA PDF lookup table or adjust consumption.',
      );
    }

    const amount = this.resolveTierAmount(tier, lookupKey);
    return {
      amount,
      applied: {
        tierId: tier.id,
        m3: this.formatM3(lookupKey),
        calculationType: tier.calculationType,
        amount: this.formatMoney(amount),
      },
    };
  }

  private resolveTierAmount(
    tier: WaterTariffTierInput,
    lookupKey: Decimal,
  ): Decimal {
    const fixed = this.toDecimal(tier.fixedAmount ?? '0', 'fixedAmount');
    const perM3 = this.toDecimal(tier.amountPerM3 ?? '0', 'amountPerM3');

    switch (tier.calculationType) {
      case WaterTariffCalculationType.LOOKUP_BY_M3:
      case WaterTariffCalculationType.FIXED_TOTAL:
        return fixed;
      case WaterTariffCalculationType.PER_M3:
        return lookupKey.mul(perM3);
      case WaterTariffCalculationType.BASE_PLUS_PER_M3:
        return fixed.plus(lookupKey.mul(perM3));
      default:
        throw new BadRequestException(
          `Unsupported calculationType: ${tier.calculationType}`,
        );
    }
  }

  private computeDiscount(
    subtotal: Decimal,
    tariff: WaterTariffInput,
  ): Decimal {
    const discountAmount = this.toDecimal(
      tariff.discountAmount ?? '0',
      'discountAmount',
    );
    const discountPercentage = this.toDecimal(
      tariff.discountPercentage ?? '0',
      'discountPercentage',
    );
    const percentPart = subtotal.mul(discountPercentage).div(HUNDRED);
    return discountAmount.plus(percentPart);
  }

  private toDecimal(value: DecimalString, field: string): Decimal {
    try {
      const d = new Decimal(value);
      if (d.isNaN()) {
        throw new Error('NaN');
      }
      return d;
    } catch {
      throw new BadRequestException(`Invalid decimal for ${field}: ${value}`);
    }
  }

  private roundDecimal(
    value: Decimal,
    places: number,
    mode: WaterTariffRoundingMode,
  ): Decimal {
    switch (mode) {
      case WaterTariffRoundingMode.FLOOR:
        return value.toDecimalPlaces(places, Decimal.ROUND_FLOOR);
      case WaterTariffRoundingMode.CEIL:
        return value.toDecimalPlaces(places, Decimal.ROUND_CEIL);
      case WaterTariffRoundingMode.HALF_EVEN:
        return value.toDecimalPlaces(places, Decimal.ROUND_HALF_EVEN);
      case WaterTariffRoundingMode.HALF_UP:
      default:
        return value.toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
    }
  }

  private formatMoney(value: Decimal): DecimalString {
    return value.toFixed(MONEY_PLACES);
  }

  private formatM3(value: Decimal): DecimalString {
    return value.toFixed(M3_PLACES);
  }
}
