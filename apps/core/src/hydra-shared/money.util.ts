import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestException } from '@nestjs/common';

const MONEY_PLACES = 2;

export function toDecimal(value: string | number | Decimal, field = 'amount'): Decimal {
  try {
    const d = value instanceof Decimal ? value : new Decimal(value);
    if (d.isNaN()) {
      throw new Error('NaN');
    }
    return d;
  } catch {
    throw new BadRequestException(`Invalid decimal for ${field}: ${value}`);
  }
}

export function assertMoneyPrecision(value: string, field = 'amount', places = MONEY_PLACES) {
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    throw new BadRequestException(`Invalid decimal format for ${field}`);
  }
  const parts = value.split('.');
  if (parts[1] && parts[1].length > places) {
    throw new BadRequestException(
      `${field} allows at most ${places} decimal places`,
    );
  }
}

export function moneyString(value: Decimal | string | number): string {
  return toDecimal(value).toFixed(MONEY_PLACES);
}

export function paginate(page?: number, pageSize?: number) {
  const take = pageSize && pageSize > 0 ? pageSize : 20;
  const skip = page && page > 0 ? (page - 1) * take : 0;
  return { skip, take };
}
