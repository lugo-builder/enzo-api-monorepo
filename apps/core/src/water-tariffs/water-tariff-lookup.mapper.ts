import { BadRequestException } from '@nestjs/common';
import { WaterTariffCalculationType } from '@prisma/client';

import { CreateLookupWaterTariffDto } from './dto/create-lookup-water-tariff.dto';
import { CreateTariffTierDto } from './dto/create-tariff-tier.dto';
import { CreateWaterTariffDto } from './dto/create-water-tariff.dto';

/**
 * Convierte el JSON tipo PDF CEA (rateTariffDate + measures) al DTO de creación Hydra.
 * Cada fila se guarda como LOOKUP_BY_M3 con m3 = clave de lookup.
 */
export function mapLookupJsonToCreateDto(
  dto: CreateLookupWaterTariffDto,
): CreateWaterTariffDto {
  const [mm, yyyy] = dto.rateTariffDate.split('-').map(Number);
  if (!mm || !yyyy) {
    throw new BadRequestException(`Invalid rateTariffDate: ${dto.rateTariffDate}`);
  }

  const effectiveFrom = new Date(Date.UTC(yyyy, mm - 1, 1, 0, 0, 0));
  const effectiveTo = new Date(Date.UTC(yyyy, mm, 0, 23, 59, 59));

  const seen = new Set<number>();
  const sorted = [...dto.measures].sort((a, b) => a.m3 - b.m3);
  for (const measure of sorted) {
    if (seen.has(measure.m3)) {
      throw new BadRequestException(`Duplicate m3 in measures: ${measure.m3}`);
    }
    seen.add(measure.m3);
  }

  const tiers: CreateTariffTierDto[] = sorted.map((measure, index) => ({
    m3: String(measure.m3),
    fixedAmount: normalizeMoneyString(measure.price),
    amountPerM3: '0',
    calculationType: WaterTariffCalculationType.LOOKUP_BY_M3,
    sortOrder: index,
  }));

  return {
    residentialComplexId: dto.residentialComplexId,
    name: dto.name ?? `Tarifa ${dto.rateTariffDate}`,
    rateTariffDate: dto.rateTariffDate,
    effectiveFrom: effectiveFrom.toISOString(),
    effectiveTo: effectiveTo.toISOString(),
    baseCharge: '0.00',
    minimumConsumptionM3: '0',
    notes:
      dto.notes ??
      `Lookup table imported from CEA PDF JSON (${dto.rateTariffDate}). Billing uses floor(m3) → price.`,
    tiers,
  };
}

/** Asegura 2 decimales en string money. */
export function normalizeMoneyString(value: string): string {
  const d = Number(value);
  if (Number.isNaN(d)) {
    throw new BadRequestException(`Invalid price: ${value}`);
  }
  return d.toFixed(2);
}
