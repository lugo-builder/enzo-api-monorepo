import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WaterMeterStatus } from '@prisma/client';

import { WaterMetersService } from './water-meters.service';

describe('WaterMetersService.importFromJson', () => {
  let service: WaterMetersService;
  let prisma: any;
  let auditService: any;

  beforeEach(() => {
    prisma = {
      residentialComplex: { findFirst: jest.fn() },
      residentialUnit: { findFirst: jest.fn() },
      waterMeter: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    service = new WaterMetersService(prisma, auditService);
  });

  it('crea medidores desde readings[] (JSON de lecturas)', async () => {
    prisma.residentialComplex.findFirst.mockResolvedValue({ id: 'hydra-1' });
    prisma.residentialUnit.findFirst.mockResolvedValue({
      id: 'unit-1',
      unitNumber: '1',
    });
    prisma.waterMeter.findFirst
      .mockResolvedValueOnce(null) // serial elsewhere
      .mockResolvedValueOnce(null); // existing on unit
    prisma.waterMeter.create.mockResolvedValue({ id: 'meter-1' });

    const result = await service.importFromJson(
      {
        residentialComplexId: 'hydra-1',
        readings: [
          {
            unitNumber: '1',
            meterSerial: '19000193',
            previousReading: '49.00',
          } as any,
        ],
      },
      'user-1',
    );

    expect(result.summary.created).toBe(1);
    expect(result.success).toBe(true);
    expect(prisma.waterMeter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitId: 'unit-1',
          serialNumber: '19000193',
          status: WaterMeterStatus.ACTIVE,
        }),
      }),
    );
  });

  it('omite si el folio ACTIVE ya existe en la misma casa', async () => {
    prisma.residentialComplex.findFirst.mockResolvedValue({ id: 'hydra-1' });
    prisma.residentialUnit.findFirst.mockResolvedValue({
      id: 'unit-1',
      unitNumber: '1',
    });
    prisma.waterMeter.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'meter-1',
        serialNumber: '19000193',
        status: WaterMeterStatus.ACTIVE,
      });

    const result = await service.importFromJson(
      {
        residentialComplexId: 'hydra-1',
        meters: [{ unitNumber: '1', serialNumber: '19000193' }],
      },
      'user-1',
    );

    expect(result.summary.skipped).toBe(1);
    expect(result.summary.created).toBe(0);
    expect(prisma.waterMeter.create).not.toHaveBeenCalled();
  });

  it('falla si el complejo no existe', async () => {
    prisma.residentialComplex.findFirst.mockResolvedValue(null);
    await expect(
      service.importFromJson(
        { residentialComplexId: 'x', meters: [{ unitNumber: '1', serialNumber: '1' }] },
        'user-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('falla sin meters ni readings', async () => {
    prisma.residentialComplex.findFirst.mockResolvedValue({ id: 'hydra-1' });
    await expect(
      service.importFromJson({ residentialComplexId: 'hydra-1' }, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
