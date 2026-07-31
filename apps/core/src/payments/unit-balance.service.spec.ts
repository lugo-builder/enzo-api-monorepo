import { ChargeMovementType, UnitChargeStatus } from '@prisma/client';

import { UnitBalanceService } from './unit-balance.service';

describe('UnitBalanceService', () => {
  let service: UnitBalanceService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      unitCharge: { findMany: jest.fn() },
      payment: { findMany: jest.fn() },
      paymentApplication: { findMany: jest.fn() },
    };
    service = new UnitBalanceService(prisma);
  });

  describe('getBalance', () => {
    it('saldo sin movimientos → 0', async () => {
      prisma.unitCharge.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.paymentApplication.findMany.mockResolvedValue([]);

      const result = await service.getBalance('unit-1');

      expect(result.charges).toBe('0.00');
      expect(result.credits).toBe('0.00');
      expect(result.payments).toBe('0.00');
      expect(result.closingBalance).toBe('0.00');
      expect(result.currentBalance).toBe('0.00');
      expect(result.pastDueBalance).toBe('0.00');
    });

    it('corte por fecha: pasa asOf como filtro a las consultas de cargos y pagos', async () => {
      prisma.unitCharge.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.paymentApplication.findMany.mockResolvedValue([]);
      const asOf = new Date('2026-06-30T00:00:00Z');

      await service.getBalance('unit-1', asOf);

      const chargeCallArgs = prisma.unitCharge.findMany.mock.calls[0][0];
      expect(chargeCallArgs.where.unitId).toBe('unit-1');
      expect(chargeCallArgs.where.chargeDate).toEqual({ lte: asOf });

      const paymentCallArgs = prisma.payment.findMany.mock.calls[0][0];
      expect(paymentCallArgs.where.unitId).toBe('unit-1');
      expect(paymentCallArgs.where.paymentDate).toEqual({ lte: asOf });
    });

    it('corte por fecha: openingFrom + asOf acotan el rango de cargos', async () => {
      prisma.unitCharge.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.paymentApplication.findMany.mockResolvedValue([]);
      const asOf = new Date('2026-06-30T00:00:00Z');
      const openingFrom = new Date('2026-06-01T00:00:00Z');

      await service.getBalance('unit-1', asOf, openingFrom);

      const chargeCallArgs = prisma.unitCharge.findMany.mock.calls[0][0];
      expect(chargeCallArgs.where.chargeDate).toEqual({ gte: openingFrom, lte: asOf });
    });

    it('saldo a favor: pagos aplicados mayores que cargos → closingBalance negativo', async () => {
      // getBalance uses charges DEBIT/CREDIT lists + payments separately
      prisma.unitCharge.findMany.mockResolvedValue([
        {
          movementType: ChargeMovementType.DEBIT,
          amount: '100.00',
          chargeTypeId: 'ct-1',
          status: UnitChargeStatus.PAID,
        },
      ]);
      prisma.payment.findMany.mockResolvedValue([
        {
          amount: '250.00',
          unappliedAmount: '50.00',
          status: 'APPLIED',
        },
      ]);
      prisma.paymentApplication.findMany.mockResolvedValue([]);

      // Spy balanceUntil for opening/current paths used inside getBalance
      jest.spyOn(service, 'balanceUntil').mockResolvedValue(require('@prisma/client/runtime/library').Decimal(0));
      jest.spyOn(service, 'pastDue').mockResolvedValue(require('@prisma/client/runtime/library').Decimal(0));

      const result = await service.getBalance('unit-1');

      // charges 100 - payments applied (250-50=200) = closing -100 → credit balance
      expect(result.charges).toBe('100.00');
      expect(result.payments).toBe('200.00');
      expect(result.unappliedPayments).toBe('50.00');
      expect(result.closingBalance).toBe('-100.00');
    });

    it('cierre mensual: openingFrom + asOf representan el mes cerrado', async () => {
      const openingFrom = new Date('2026-05-01T00:00:00.000Z');
      const asOf = new Date('2026-05-31T23:59:59.999Z');
      prisma.unitCharge.findMany.mockResolvedValue([
        {
          movementType: ChargeMovementType.DEBIT,
          amount: '165.00',
          chargeTypeId: 'ordinary',
        },
      ]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.paymentApplication.findMany.mockResolvedValue([]);
      jest
        .spyOn(service, 'balanceUntil')
        .mockResolvedValue(require('@prisma/client/runtime/library').Decimal(500));
      jest
        .spyOn(service, 'pastDue')
        .mockResolvedValue(require('@prisma/client/runtime/library').Decimal(0));

      const result = await service.getBalance('unit-1', asOf, openingFrom);

      expect(result.openingBalance).toBe('500.00');
      expect(result.charges).toBe('165.00');
      // 500 + 165 - 0 payments = 665
      expect(result.closingBalance).toBe('665.00');
    });
  });

  describe('balanceUntil', () => {
    it('saldo con cargos DEBIT incrementa el balance', async () => {
      prisma.unitCharge.findMany.mockResolvedValue([
        {
          movementType: ChargeMovementType.DEBIT,
          amount: '500.00',
          chargeTypeId: 'ct-1',
        },
      ]);
      prisma.paymentApplication.findMany.mockResolvedValue([]);

      const balance = await service.balanceUntil('unit-1');

      expect(balance.toString()).toBe('500');
    });

    it('saldo con CREDIT reduce el balance', async () => {
      prisma.unitCharge.findMany.mockResolvedValue([
        {
          movementType: ChargeMovementType.CREDIT,
          amount: '200.00',
          chargeTypeId: 'ct-1',
        },
      ]);
      prisma.paymentApplication.findMany.mockResolvedValue([]);

      const balance = await service.balanceUntil('unit-1');

      expect(balance.toString()).toBe('-200');
    });

    it('saldo a favor: pagos aplicados superan los cargos DEBIT', async () => {
      prisma.unitCharge.findMany.mockResolvedValue([
        {
          movementType: ChargeMovementType.DEBIT,
          amount: '100.00',
          chargeTypeId: 'ct-1',
        },
      ]);
      prisma.paymentApplication.findMany.mockResolvedValue([{ amount: '250.00' }]);

      const balance = await service.balanceUntil('unit-1');

      expect(balance.toString()).toBe('-150');
      expect(balance.isNegative()).toBe(true);
    });
  });

  describe('pastDue', () => {
    it('calcula el saldo vencido restando aplicaciones activas', async () => {
      prisma.unitCharge.findMany.mockResolvedValue([
        {
          id: 'charge-1',
          amount: '300.00',
          movementType: ChargeMovementType.DEBIT,
          status: UnitChargeStatus.PARTIALLY_PAID,
          paymentApplications: [{ amount: '100.00' }],
        },
      ]);

      const due = await service.pastDue('unit-1', new Date('2026-07-01T00:00:00Z'));

      expect(due.toString()).toBe('200');
    });

    it('regresa 0 cuando no hay cargos vencidos', async () => {
      prisma.unitCharge.findMany.mockResolvedValue([]);

      const due = await service.pastDue('unit-1', new Date());

      expect(due.toString()).toBe('0');
    });
  });

  describe('remainingChargeAmount', () => {
    it('calcula el remanente de un cargo DEBIT restando aplicaciones activas', async () => {
      prisma.unitCharge.findUniqueOrThrow = jest.fn().mockResolvedValue({
        amount: '500.00',
        movementType: ChargeMovementType.DEBIT,
        paymentApplications: [{ amount: '200.00' }],
      });

      const remaining = await service.remainingChargeAmount('charge-1');

      expect(remaining.toString()).toBe('300');
    });

    it('regresa 0 para cargos CREDIT', async () => {
      prisma.unitCharge.findUniqueOrThrow = jest.fn().mockResolvedValue({
        amount: '500.00',
        movementType: ChargeMovementType.CREDIT,
        paymentApplications: [],
      });

      const remaining = await service.remainingChargeAmount('charge-1');

      expect(remaining.toString()).toBe('0');
    });
  });
});
