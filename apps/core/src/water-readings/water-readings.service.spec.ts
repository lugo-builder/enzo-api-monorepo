import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  WaterBillingPeriodStatus,
  WaterReadingCalculationMode,
  WaterReadingStatus,
} from '@prisma/client';

import { WaterReadingsService } from './water-readings.service';

describe('WaterReadingsService', () => {
  let service: WaterReadingsService;
  let prisma: any;
  let auditService: any;

  const baseReading = (overrides: any = {}) => ({
    id: 'reading-1',
    previousReading: '10.0000',
    currentReading: '15.0000',
    status: WaterReadingStatus.CAPTURED,
    calculationMode: WaterReadingCalculationMode.ACTUAL,
    billingPeriod: { status: WaterBillingPeriodStatus.OPEN },
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      waterReading: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    service = new WaterReadingsService(prisma, auditService);
  });

  describe('update', () => {
    it('lectura final menor a la anterior sin METER_REPLACEMENT lanza BadRequestException', async () => {
      prisma.waterReading.findUnique.mockResolvedValue(
        baseReading({ previousReading: '20.0000', currentReading: '15.0000' }),
      );

      await expect(
        service.update('reading-1', { currentReading: '5.0000' } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.waterReading.update).not.toHaveBeenCalled();
    });

    it('lectura final menor con calculationMode METER_REPLACEMENT es permitida', async () => {
      prisma.waterReading.findUnique.mockResolvedValue(
        baseReading({ previousReading: '20.0000', currentReading: '20.0000' }),
      );
      prisma.waterReading.update.mockResolvedValue({
        id: 'reading-1',
        currentReading: '5.0000',
      });

      const result = await service.update(
        'reading-1',
        {
          currentReading: '5.0000',
          calculationMode: WaterReadingCalculationMode.METER_REPLACEMENT,
        } as any,
        'user-1',
      );

      expect(result).toEqual({ id: 'reading-1', currentReading: '5.0000' });
      expect(prisma.waterReading.update).toHaveBeenCalledTimes(1);
      const callArgs = prisma.waterReading.update.mock.calls[0][0];
      expect(callArgs.where).toEqual({ id: 'reading-1' });
      expect(callArgs.data.calculationMode).toBe(
        WaterReadingCalculationMode.METER_REPLACEMENT,
      );
      expect(auditService.log).toHaveBeenCalledTimes(1);
    });

    it('periodo CLOSED lanza ConflictException', async () => {
      prisma.waterReading.findUnique.mockResolvedValue(
        baseReading({
          billingPeriod: { status: WaterBillingPeriodStatus.CLOSED },
        }),
      );

      await expect(
        service.update('reading-1', { currentReading: '16.0000' } as any, 'user-1'),
      ).rejects.toThrow(ConflictException);

      expect(prisma.waterReading.update).not.toHaveBeenCalled();
    });

    it('actualiza correctamente cuando el periodo está abierto', async () => {
      prisma.waterReading.findUnique.mockResolvedValue(baseReading());
      prisma.waterReading.update.mockResolvedValue({
        id: 'reading-1',
        currentReading: '18.0000',
        status: WaterReadingStatus.CAPTURED,
      });

      const result = await service.update(
        'reading-1',
        { currentReading: '18.0000', notes: 'lectura ok' } as any,
        'user-1',
      );

      expect(result.currentReading).toBe('18.0000');
      expect(prisma.waterReading.update).toHaveBeenCalledTimes(1);
      const callArgs = prisma.waterReading.update.mock.calls[0][0];
      expect(callArgs.data.status).toBe(WaterReadingStatus.CAPTURED);
      expect(callArgs.data.updatedBy).toBe('user-1');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'WaterReading',
          entityId: 'reading-1',
          action: 'WATER_READING_UPDATE',
        }),
      );
    });

    it('lectura CANCELLED no puede editarse', async () => {
      prisma.waterReading.findUnique.mockResolvedValue(
        baseReading({ status: WaterReadingStatus.CANCELLED }),
      );

      await expect(
        service.update('reading-1', { currentReading: '19.0000' } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('lanza NotFoundException cuando no existe la lectura', async () => {
      prisma.waterReading.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        'Water reading not found',
      );
    });
  });
});
