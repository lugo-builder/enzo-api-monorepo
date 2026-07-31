import { WaterTariffCalculationType } from '@prisma/client';

import { mapLookupJsonToCreateDto } from './water-tariff-lookup.mapper';

describe('mapLookupJsonToCreateDto', () => {
  it('maps rateTariffDate and measures to LOOKUP_BY_M3 tiers', () => {
    const dto = mapLookupJsonToCreateDto({
      residentialComplexId: 'hydra-1',
      rateTariffDate: '05-2026',
      measures: [
        { m3: 5, price: '157.00' },
        { m3: 0, price: '68' },
      ],
    });

    expect(dto.name).toBe('Tarifa 05-2026');
    expect(dto.rateTariffDate).toBe('05-2026');
    expect(dto.residentialComplexId).toBe('hydra-1');
    expect(dto.effectiveFrom.startsWith('2026-05-01')).toBe(true);
    expect(dto.tiers).toHaveLength(2);
    expect(dto.tiers[0]).toMatchObject({
      m3: '0',
      fixedAmount: '68.00',
      calculationType: WaterTariffCalculationType.LOOKUP_BY_M3,
    });
    expect(dto.tiers[1]).toMatchObject({
      m3: '5',
      fixedAmount: '157.00',
      calculationType: WaterTariffCalculationType.LOOKUP_BY_M3,
    });
  });

  it('rejects duplicate m3 rows', () => {
    expect(() =>
      mapLookupJsonToCreateDto({
        residentialComplexId: 'hydra-1',
        rateTariffDate: '05-2026',
        measures: [
          { m3: 1, price: '85.00' },
          { m3: 1, price: '86.00' },
        ],
      }),
    ).toThrow(/Duplicate m3/);
  });
});
