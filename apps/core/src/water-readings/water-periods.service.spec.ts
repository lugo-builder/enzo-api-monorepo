import { BadRequestException } from '@nestjs/common';
import { WaterBillingPeriodStatus } from '@prisma/client';

import { WaterPeriodsService } from './water-periods.service';

describe('WaterPeriodsService (close/reopen/calculate guards)', () => {
  let service: WaterPeriodsService;
  let prisma: any;
  let auditService: any;
  let calculator: any;
  let waterTariffsService: any;

  const basePeriod = (overrides: any = {}) => ({
    id: 'period-1',
    residentialComplexId: 'condo-1',
    tariffId: 'tariff-1',
    tariff: { tiers: [{ id: 't1' }] },
    status: WaterBillingPeriodStatus.CALCULATED,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      waterBillingPeriod: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      waterReading: { findMany: jest.fn() },
      chargeType: { findFirst: jest.fn(), create: jest.fn() },
      billingPeriod: { findFirst: jest.fn() },
      unitCharge: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      importBatch: {
        create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      },
      residentialUnit: { count: jest.fn() },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    calculator = { calculate: jest.fn() };
    waterTariffsService = { toCalculatorInput: jest.fn() };
    service = new WaterPeriodsService(
      prisma,
      auditService,
      calculator,
      waterTariffsService,
    );
  });

  describe('close', () => {
    it('cierra un periodo CALCULATED y cambia su status a CLOSED', async () => {
      prisma.waterBillingPeriod.findUnique.mockResolvedValue(basePeriod());
      prisma.waterBillingPeriod.update.mockResolvedValue(
        basePeriod({ status: WaterBillingPeriodStatus.CLOSED }),
      );

      const result = await service.close('period-1', 'user-1');

      expect(result.status).toBe(WaterBillingPeriodStatus.CLOSED);
      const callArgs = prisma.waterBillingPeriod.update.mock.calls[0][0];
      expect(callArgs.where).toEqual({ id: 'period-1' });
      expect(callArgs.data.status).toBe(WaterBillingPeriodStatus.CLOSED);
      expect(callArgs.data.closedBy).toBe('user-1');
      expect(callArgs.data.closedAt).toBeInstanceOf(Date);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WATER_PERIOD_CLOSE' }),
      );
    });

    it('rechaza cerrar un periodo que no está CALCULATED', async () => {
      prisma.waterBillingPeriod.findUnique.mockResolvedValue(
        basePeriod({ status: WaterBillingPeriodStatus.OPEN }),
      );

      await expect(service.close('period-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.waterBillingPeriod.update).not.toHaveBeenCalled();
    });

    it('rechaza cerrar un periodo ya CLOSED', async () => {
      prisma.waterBillingPeriod.findUnique.mockResolvedValue(
        basePeriod({ status: WaterBillingPeriodStatus.CLOSED }),
      );

      await expect(service.close('period-1', 'user-1')).rejects.toThrow(
        'Only calculated periods can be closed',
      );
    });
  });

  describe('reopen', () => {
    it('reabre un periodo CLOSED y regresa su status a CALCULATED', async () => {
      prisma.waterBillingPeriod.findUnique.mockResolvedValue(
        basePeriod({ status: WaterBillingPeriodStatus.CLOSED }),
      );
      prisma.waterBillingPeriod.update.mockResolvedValue(
        basePeriod({ status: WaterBillingPeriodStatus.CALCULATED }),
      );

      const result = await service.reopen('period-1', 'user-1');

      expect(result.status).toBe(WaterBillingPeriodStatus.CALCULATED);
      const callArgs = prisma.waterBillingPeriod.update.mock.calls[0][0];
      expect(callArgs.data.status).toBe(WaterBillingPeriodStatus.CALCULATED);
      expect(callArgs.data.closedAt).toBeNull();
      expect(callArgs.data.closedBy).toBeNull();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WATER_PERIOD_REOPEN' }),
      );
    });

    it('rechaza reabrir un periodo que no está CLOSED', async () => {
      prisma.waterBillingPeriod.findUnique.mockResolvedValue(
        basePeriod({ status: WaterBillingPeriodStatus.CALCULATED }),
      );

      await expect(service.reopen('period-1', 'user-1')).rejects.toThrow(
        'Only closed periods can be reopened',
      );
      expect(prisma.waterBillingPeriod.update).not.toHaveBeenCalled();
    });
  });

  describe('calculate (guards)', () => {
    it('rechaza calcular un periodo sin tariff asignado', async () => {
      prisma.waterBillingPeriod.findUnique.mockResolvedValue(
        basePeriod({ tariffId: null, tariff: null }),
      );

      await expect(service.calculate('period-1', 'user-1')).rejects.toThrow(
        'Water billing period has no tariff assigned',
      );
      expect(prisma.waterReading.findMany).not.toHaveBeenCalled();
    });

    it('rechaza calcular cuando el tariff no tiene tramos configurados', async () => {
      prisma.waterBillingPeriod.findUnique.mockResolvedValue(
        basePeriod({ tariff: { tiers: [] } }),
      );

      await expect(service.calculate('period-1', 'user-1')).rejects.toThrow(
        'Assigned tariff has no m3 rows configured',
      );
    });
  });

  describe('importReadingsFromJson', () => {
    beforeEach(() => {
      prisma.waterMeter = { findFirst: jest.fn() };
      prisma.residentialUnit = {
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(90),
      };
      prisma.waterReading.findUnique = jest.fn();
      prisma.waterReading.upsert = jest.fn();
      prisma.waterReading.create = jest.fn();
      prisma.waterReading.update = jest.fn();
      prisma.waterReading.findMany = jest.fn().mockResolvedValue([]);
      prisma.waterBillingPeriod.update = jest.fn();
      prisma.chargeType = { findFirst: jest.fn(), create: jest.fn() };
      prisma.billingPeriod = { findFirst: jest.fn() };
      prisma.unitCharge = {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      };
      prisma.importBatch = {
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: 'batch-readings' })
          .mockResolvedValue({ id: 'batch-report' }),
      };
    });

    it('importa por meterSerial y calcula si calculate=true', async () => {
      prisma.waterBillingPeriod.findUnique.mockResolvedValue(
        basePeriod({
          status: WaterBillingPeriodStatus.DRAFT,
          tariff: { tiers: [{ id: 't1' }] },
        }),
      );
      prisma.waterMeter.findFirst.mockResolvedValue({
        id: 'meter-1',
        serialNumber: 'MED-001',
        unit: { id: 'unit-1', unitNumber: '1' },
      });
      prisma.waterReading.findUnique.mockResolvedValue(null);
      prisma.waterReading.upsert.mockResolvedValue({ id: 'r1' });
      prisma.waterReading.findMany
        .mockResolvedValueOnce([
          {
            id: 'r1',
            unitId: 'unit-1',
            previousReading: '438',
            currentReading: '441',
            macroDifferencePrice: '0',
            manualAdjustment: '0',
            reserveFundAmount: '0',
            serviceFeeAmount: '40.00',
            unit: { unitNumber: '1' },
          },
        ])
        .mockResolvedValueOnce([]);
      prisma.chargeType.findFirst.mockResolvedValue({ id: 'ct-water' });
      prisma.billingPeriod.findFirst.mockResolvedValue(null);
      prisma.unitCharge.findUnique.mockResolvedValue(null);
      prisma.unitCharge.create.mockResolvedValue({});
      waterTariffsService.toCalculatorInput.mockReturnValue({ tiers: [] });
      calculator.calculate.mockReturnValue({
        total: '120.00',
        adjustedConsumption: '3.00',
        baseCharge: '0.00',
        macroAdjustment: '0.00',
        manualAdjustment: '0.00',
        reserveFund: '0.00',
      });

      const result = await service.importReadingsFromJson(
        'period-1',
        {
          priceService: '40.00',
          calculate: true,
          readings: [
            {
              meterSerial: 'MED-001',
              previousReading: '438.00',
              currentReading: '441.00',
              macroDifferencePrice: '0.00',
            },
          ],
        },
        'user-1',
      );

      expect(result.import.success).toBe(true);
      expect(result.import.summary.processed).toBe(1);
      expect(result.import.summary.created).toBe(1);
      expect(result.import.summary.updated).toBe(0);
      expect(prisma.waterReading.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            billingPeriodId_unitId: {
              billingPeriodId: 'period-1',
              unitId: 'unit-1',
            },
          },
          create: expect.objectContaining({
            serviceFeeAmount: expect.anything(),
          }),
          update: expect.objectContaining({
            macroDifferencePrice: expect.anything(),
            status: 'CAPTURED',
          }),
        }),
      );
      expect(calculator.calculate).toHaveBeenCalled();
      expect(prisma.importBatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'WATER_READINGS',
            relatedEntityType: 'WaterBillingPeriod',
            relatedEntityId: 'period-1',
          }),
        }),
      );
      expect(result.import.importBatchId).toBe('batch-readings');
      expect(result.reportImportBatchId).toBe('batch-report');
    });

    it('hace upsert y reporta updated al reimportar la misma casa', async () => {
      prisma.waterBillingPeriod.findUnique.mockResolvedValue(
        basePeriod({
          status: WaterBillingPeriodStatus.CALCULATED,
          tariff: { tiers: [{ id: 't1' }] },
        }),
      );
      prisma.waterMeter.findFirst.mockResolvedValue({
        id: 'meter-1',
        serialNumber: 'MED-001',
        unit: { id: 'unit-1', unitNumber: '1' },
      });
      prisma.waterReading.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'CAPTURED',
      });
      prisma.waterReading.upsert.mockResolvedValue({ id: 'r1' });
      prisma.waterReading.findMany
        .mockResolvedValueOnce([
          {
            id: 'r1',
            unitId: 'unit-1',
            previousReading: '438',
            currentReading: '441',
            macroDifferencePrice: '10',
            manualAdjustment: '0',
            reserveFundAmount: '0',
            serviceFeeAmount: '40.00',
            unit: { unitNumber: '1' },
          },
        ])
        .mockResolvedValueOnce([]);
      prisma.chargeType.findFirst.mockResolvedValue({ id: 'ct-water' });
      prisma.billingPeriod.findFirst.mockResolvedValue(null);
      prisma.unitCharge.findUnique.mockResolvedValue(null);
      prisma.unitCharge.create.mockResolvedValue({});
      waterTariffsService.toCalculatorInput.mockReturnValue({ tiers: [] });
      calculator.calculate.mockReturnValue({
        total: '130.00',
        adjustedConsumption: '3.00',
        baseCharge: '0.00',
        macroAdjustment: '10.00',
        manualAdjustment: '0.00',
        reserveFund: '0.00',
      });

      const result = await service.importReadingsFromJson(
        'period-1',
        {
          priceService: '40.00',
          calculate: true,
          readings: [
            {
              meterSerial: 'MED-001',
              previousReading: '438.00',
              currentReading: '441.00',
              macroDifferencePrice: '10.00',
            },
          ],
        },
        'user-1',
      );

      expect(result.import.summary.created).toBe(0);
      expect(result.import.summary.updated).toBe(1);
      expect(prisma.waterReading.upsert).toHaveBeenCalled();
      expect(prisma.waterBillingPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: WaterBillingPeriodStatus.OPEN }),
        }),
      );
    });

    it('rechaza import en periodo CLOSED', async () => {
      prisma.waterBillingPeriod.findUnique.mockResolvedValue(
        basePeriod({ status: WaterBillingPeriodStatus.CLOSED }),
      );

      await expect(
        service.importReadingsFromJson(
          'period-1',
          {
            readings: [
              {
                meterSerial: 'MED-001',
                previousReading: '1',
                currentReading: '2',
              },
            ],
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getReport', () => {
    it('arma filas del reporte CEA con totales', async () => {
      prisma.waterBillingPeriod.findUnique.mockResolvedValue(
        basePeriod({
          name: 'Julio 2026',
          billingYear: 2026,
          billingMonth: 7,
          tariff: { id: 'tariff-1', name: 'Tarifa 05-2026', tiers: [] },
        }),
      );
      prisma.residentialUnit = {
        count: jest.fn().mockResolvedValue(90),
      };
      prisma.waterReading.findMany.mockResolvedValue([
        {
          previousReading: '438',
          currentReading: '441',
          consumptionM3: '3',
          macroDifferencePrice: '0',
          calculatedAmount: '120.00',
          serviceFeeAmount: '40.00',
          finalAmount: '160.00',
          status: 'CALCULATED',
          unit: { unitNumber: '1' },
          waterMeter: { serialNumber: 'MED-001' },
        },
      ]);

      const report = await service.getReport('period-1');

      expect(report.fileNameHint).toBe('7_2026_CEA_Lecturas_Hydra_Final');
      expect(report.summary.expectedUnits).toBe(90);
      expect(report.summary.readingsCount).toBe(1);
      expect(report.summary.priceService).toBe('40.00');
      expect(report.summary.totalWaterAmount).toBe('160.00');
      expect(report.rows[0]).toMatchObject({
        unitNumber: '1',
        meterSerial: 'MED-001',
        waterAmount: '120.00',
        serviceFeeAmount: '40.00',
        totalAmount: '160.00',
        macroDifferencePrice: '0.00',
        previousReading: '438.00',
        currentReading: '441.00',
        consumptionM3: '3.00',
      });
    });
  });

  describe('generateReadingRecords (herencia periodo anterior)', () => {
    beforeEach(() => {
      prisma.residentialUnit.findMany = jest.fn();
      prisma.waterMeter = { findFirst: jest.fn() };
      prisma.waterReading.findUnique = jest.fn();
      prisma.waterReading.findFirst = jest.fn();
      prisma.waterReading.create = jest.fn();
      prisma.waterReading.update = jest.fn();
    });

    it('usa currentReading del periodo inmediato anterior como previousReading', async () => {
      prisma.waterBillingPeriod.findUnique
        .mockResolvedValueOnce(
          basePeriod({
            id: 'period-june',
            billingYear: 2026,
            billingMonth: 6,
            status: WaterBillingPeriodStatus.OPEN,
          }),
        )
        .mockResolvedValueOnce({
          id: 'period-may',
          billingYear: 2026,
          billingMonth: 5,
        });
      prisma.residentialUnit.findMany.mockResolvedValue([
        { id: 'unit-1', unitNumber: '1' },
      ]);
      prisma.waterMeter.findFirst.mockResolvedValue({
        id: 'meter-1',
        initialReading: '10.00',
      });
      prisma.waterReading.findUnique.mockResolvedValue(null);
      prisma.waterReading.findFirst.mockResolvedValue({
        currentReading: '50.00',
      });
      prisma.waterReading.create.mockResolvedValue({ id: 'r-new' });

      const result = await service.generateReadingRecords(
        'period-june',
        'user-1',
      );

      expect(prisma.waterBillingPeriod.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            residentialComplexId_billingYear_billingMonth: {
              residentialComplexId: 'condo-1',
              billingYear: 2026,
              billingMonth: 5,
            },
          },
        }),
      );
      expect(prisma.waterReading.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousReading: expect.anything(),
            currentReading: expect.anything(),
            status: 'DRAFT',
          }),
        }),
      );
      const createdData = prisma.waterReading.create.mock.calls[0][0].data;
      expect(createdData.previousReading.toString()).toBe('50');
      expect(result.summary.created).toBe(1);
    });

    it('si no hay periodo anterior, usa initialReading del medidor', async () => {
      prisma.waterBillingPeriod.findUnique
        .mockResolvedValueOnce(
          basePeriod({
            id: 'period-may',
            billingYear: 2026,
            billingMonth: 5,
            status: WaterBillingPeriodStatus.OPEN,
          }),
        )
        .mockResolvedValueOnce(null);
      prisma.residentialUnit.findMany.mockResolvedValue([
        { id: 'unit-1', unitNumber: '1' },
      ]);
      prisma.waterMeter.findFirst.mockResolvedValue({
        id: 'meter-1',
        initialReading: '49.00',
      });
      prisma.waterReading.findUnique.mockResolvedValue(null);
      prisma.waterReading.create.mockResolvedValue({ id: 'r-new' });

      await service.generateReadingRecords('period-may', 'user-1');

      const createdData = prisma.waterReading.create.mock.calls[0][0].data;
      expect(createdData.previousReading.toString()).toBe('49');
    });

    it('resincroniza previousReading en DRAFT existente', async () => {
      prisma.waterBillingPeriod.findUnique
        .mockResolvedValueOnce(
          basePeriod({
            id: 'period-june',
            billingYear: 2026,
            billingMonth: 6,
            status: WaterBillingPeriodStatus.OPEN,
          }),
        )
        .mockResolvedValueOnce({ id: 'period-may' });
      prisma.residentialUnit.findMany.mockResolvedValue([
        { id: 'unit-1', unitNumber: '1' },
      ]);
      prisma.waterMeter.findFirst.mockResolvedValue({
        id: 'meter-1',
        initialReading: '10.00',
      });
      prisma.waterReading.findUnique.mockResolvedValue({
        id: 'r-existing',
        status: 'DRAFT',
        previousReading: '0.00',
        currentReading: '0.00',
      });
      prisma.waterReading.findFirst.mockResolvedValue({
        currentReading: '50.00',
      });
      prisma.waterReading.update.mockResolvedValue({});

      const result = await service.generateReadingRecords(
        'period-june',
        'user-1',
      );

      expect(prisma.waterReading.create).not.toHaveBeenCalled();
      expect(prisma.waterReading.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r-existing' },
          data: expect.objectContaining({
            previousReading: expect.anything(),
            currentReading: expect.anything(),
          }),
        }),
      );
      expect(result.summary.updated).toBe(1);
    });
  });
});
