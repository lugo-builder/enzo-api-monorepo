import { compareUnitNumber, sortByUnitNumber } from './unit-order.util';

describe('unit-order.util', () => {
  it('ordena numéricamente y no alfabéticamente', () => {
    const input = ['10', '2', '1', '90', '9', '11'];
    expect(input.sort(compareUnitNumber)).toEqual([
      '1',
      '2',
      '9',
      '10',
      '11',
      '90',
    ]);
  });

  it('coloca casas no numéricas al final', () => {
    const input = ['B2', '3', '1'];
    expect(input.sort(compareUnitNumber)).toEqual(['1', '3', 'B2']);
  });

  it('sortByUnitNumber no muta el arreglo original', () => {
    const rows = [{ unit: { unitNumber: '10' } }, { unit: { unitNumber: '2' } }];
    const sorted = sortByUnitNumber(rows, (r) => r.unit.unitNumber);

    expect(sorted.map((r) => r.unit.unitNumber)).toEqual(['2', '10']);
    expect(rows.map((r) => r.unit.unitNumber)).toEqual(['10', '2']);
  });
});
