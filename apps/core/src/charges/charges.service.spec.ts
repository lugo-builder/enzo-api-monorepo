import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UnitChargeStatus } from '@prisma/client';

import { ChargesService } from './charges.service';

describe('ChargesService', () => {
  let service: ChargesService;
  let prisma: any;
  let auditService: any;

  const chargeFixture = (overrides: any = {}) => ({
    id: 'charge-1',
    unitId: 'unit-1',
    amount: '500.00',
    status: UnitChargeStatus.PENDING,
    paymentApplications: [],
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      unitCharge: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      residentialUnit: { findFirst: jest.fn() },
      chargeType: { findUnique: jest.fn() },
      billingPeriod: { findUnique: jest.fn().mockResolvedValue({ status: 'OPEN' }) },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    service = new ChargesService(prisma, auditService);
  });

  describe('create', () => {
    it('crea un cargo cuando la unidad y el charge type existen', async () => {
      prisma.residentialUnit.findFirst.mockResolvedValue({ id: 'unit-1' });
      prisma.chargeType.findUnique.mockResolvedValue({ id: 'ct-1' });
      prisma.unitCharge.create.mockResolvedValue(chargeFixture());

      const result = await service.create(
        {
          unitId: 'unit-1',
          chargeTypeId: 'ct-1',
          amount: '500.00',
        } as any,
        'user-1',
      );

      expect(result.amount).toBe('500.00');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CHARGE_CREATE' }),
      );
    });

    it('lanza NotFoundException si la unidad no existe', async () => {
      prisma.residentialUnit.findFirst.mockResolvedValue(null);
      prisma.chargeType.findUnique.mockResolvedValue({ id: 'ct-1' });

      await expect(
        service.create({ unitId: 'missing', chargeTypeId: 'ct-1', amount: '1' } as any, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('cancelación: cancela un cargo sin aplicaciones activas', async () => {
      prisma.unitCharge.findUnique.mockResolvedValue(chargeFixture());
      prisma.unitCharge.update.mockResolvedValue(
        chargeFixture({ status: UnitChargeStatus.CANCELLED }),
      );

      const result = await service.cancel('charge-1', 'duplicado', 'user-1');

      expect(result.status).toBe(UnitChargeStatus.CANCELLED);
      const updateArgs = prisma.unitCharge.update.mock.calls[0][0];
      expect(updateArgs.data.status).toBe(UnitChargeStatus.CANCELLED);
      expect(updateArgs.data.cancellationReason).toBe('duplicado');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CHARGE_CANCEL' }),
      );
    });

    it('rechaza cancelar un cargo que ya está CANCELLED', async () => {
      prisma.unitCharge.findUnique.mockResolvedValue(
        chargeFixture({ status: UnitChargeStatus.CANCELLED }),
      );

      await expect(service.cancel('charge-1', 'x', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.unitCharge.update).not.toHaveBeenCalled();
    });

    it('rechaza cancelar un cargo con aplicaciones de pago activas', async () => {
      prisma.unitCharge.findUnique.mockResolvedValue(
        chargeFixture({
          paymentApplications: [{ id: 'app-1', amount: '100.00', reversedAt: null }],
        }),
      );

      await expect(service.cancel('charge-1', 'x', 'user-1')).rejects.toThrow(
        'Charge has active payment applications; reverse them before cancelling',
      );
      expect(prisma.unitCharge.update).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el cargo no existe', async () => {
      prisma.unitCharge.findUnique.mockResolvedValue(null);

      await expect(service.cancel('missing', 'x', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('rechaza editar un cargo CANCELLED', async () => {
      prisma.unitCharge.findUnique.mockResolvedValue(
        chargeFixture({ status: UnitChargeStatus.CANCELLED }),
      );

      await expect(
        service.update('charge-1', { amount: '999.00' } as any, 'user-1'),
      ).rejects.toThrow('Cannot edit a cancelled charge');
    });

    it('permite editar un cargo PENDING', async () => {
      prisma.unitCharge.findUnique.mockResolvedValue(
        chargeFixture({ paymentApplications: [] }),
      );
      prisma.unitCharge.update.mockResolvedValue(chargeFixture({ amount: '600.00' }));

      const result = await service.update(
        'charge-1',
        { amount: '600.00' } as any,
        'user-1',
      );

      expect(result.amount).toBe('600.00');
    });

    it('bloquea editar monto si el cargo tiene aplicaciones de pago activas', async () => {
      prisma.unitCharge.findUnique.mockResolvedValue(
        chargeFixture({
          paymentApplications: [{ id: 'app-1', amount: '100.00' }],
        }),
      );

      await expect(
        service.update('charge-1', { amount: '999.00' } as any, 'user-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.unitCharge.update).not.toHaveBeenCalled();
    });
  });
});
