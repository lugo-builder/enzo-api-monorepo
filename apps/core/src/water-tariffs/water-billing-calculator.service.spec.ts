import { BadRequestException } from '@nestjs/common';

import { WaterTariffCalculationType } from './enums/water-tariff-calculation-type.enum';
import { WaterTariffInput } from './interfaces/water-billing-calculator.interface';
import { WaterBillingCalculatorService } from './water-billing-calculator.service';

describe('WaterBillingCalculatorService', () => {
  let service: WaterBillingCalculatorService;

  beforeEach(() => {
    service = new WaterBillingCalculatorService();
  });

  /** Tabla lookup simple: m3 → precio total. */
  const lookupTariff = (
    rows: Array<{ m3: number; price: string; id?: string }>,
    extras: Partial<WaterTariffInput> = {},
  ): WaterTariffInput => ({
    baseCharge: '0.00',
    minimumConsumptionM3: '0',
    discountAmount: '0',
    discountPercentage: '0',
    tiers: rows.map((row, index) => ({
      id: row.id ?? `m${row.m3}`,
      m3: String(row.m3),
      fixedAmount: row.price,
      calculationType: WaterTariffCalculationType.LOOKUP_BY_M3,
      sortOrder: index,
    })),
    ...extras,
  });

  describe('LOOKUP_BY_M3', () => {
    const ceaSnippet = () =>
      lookupTariff([
        { m3: 0, price: '68.00' },
        { m3: 3, price: '120.00' },
        { m3: 5, price: '157.00' },
        { m3: 8, price: '220.00' },
        { m3: 25, price: '763.00' },
      ]);

    it('Hydra 1 con 5 m³ obtiene el precio exacto de la fila 5', () => {
      const result = service.calculate({ consumptionM3: '5' }, ceaSnippet());
      expect(result.tierAmount).toBe('157.00');
      expect(result.total).toBe('157.00');
      expect(result.appliedTier).toHaveLength(1);
      expect(result.appliedTier[0].m3).toBe('5.0000');
      expect(result.appliedTier[0].calculationType).toBe(
        WaterTariffCalculationType.LOOKUP_BY_M3,
      );
    });

    it('consumo fraccionario usa floor (5.7 → fila 5)', () => {
      const result = service.calculate({ consumptionM3: '5.7' }, ceaSnippet());
      expect(result.billingConsumption).toBe('5.7000');
      expect(result.tierAmount).toBe('157.00');
    });

    it('0 m³ usa la fila 0 del PDF', () => {
      const result = service.calculate({ consumptionM3: '0' }, ceaSnippet());
      expect(result.tierAmount).toBe('68.00');
    });

    it('falla si el m³ no está en la tabla', () => {
      expect(() =>
        service.calculate({ consumptionM3: '6' }, ceaSnippet()),
      ).toThrow(/No tariff row for 6/);
    });

    it('aplica minimumConsumptionM3 antes del lookup', () => {
      const result = service.calculate(
        { consumptionM3: '0' },
        lookupTariff(
          [
            { m3: 0, price: '68.00' },
            { m3: 3, price: '120.00' },
          ],
          { minimumConsumptionM3: '3' },
        ),
      );
      expect(result.billingConsumption).toBe('3.0000');
      expect(result.tierAmount).toBe('120.00');
    });
  });

  describe('adjustments and discounts', () => {
    it('aplica macroDifferencePrice como dinero sin tocar m³', () => {
      const result = service.calculate(
        { consumptionM3: '5', macroDifferencePrice: '10.00' },
        lookupTariff([{ m3: 5, price: '157.00' }]),
      );
      expect(result.adjustedConsumption).toBe('5.0000');
      expect(result.macroAdjustment).toBe('10.00');
      expect(result.total).toBe('167.00');
    });

    it('aplica manualAdjustment y reserveFund al total', () => {
      const result = service.calculate(
        {
          consumptionM3: '0',
          manualAdjustment: '15.50',
          reserveFund: '5.00',
        },
        lookupTariff([{ m3: 0, price: '68.00' }]),
      );
      expect(result.total).toBe('88.50');
    });

    it('aplica descuento fijo y porcentual sobre subtotal', () => {
      const result = service.calculate(
        { consumptionM3: '5' },
        lookupTariff([{ m3: 5, price: '100.00' }], {
          discountAmount: '10.00',
          discountPercentage: '20',
        }),
      );
      // subtotal 100; descuento 10 + 20 = 30; total 70
      expect(result.discount).toBe('30.00');
      expect(result.total).toBe('70.00');
    });

    it('suma baseCharge al precio de lookup', () => {
      const result = service.calculate(
        { consumptionM3: '0' },
        lookupTariff([{ m3: 0, price: '68.00' }], { baseCharge: '40.00' }),
      );
      expect(result.baseCharge).toBe('40.00');
      expect(result.total).toBe('108.00');
    });

    it('rejects negative consumption', () => {
      expect(() =>
        service.calculate(
          { consumptionM3: '-5' },
          lookupTariff([{ m3: 0, price: '68.00' }]),
        ),
      ).toThrow(BadRequestException);
    });

    it('rejects empty tariff', () => {
      expect(() =>
        service.calculate({ consumptionM3: '0' }, { tiers: [] }),
      ).toThrow(/no m3 rows/);
    });
  });
});
