import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PaymentStatus, UnitChargeStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { PaymentApplicationService } from './payment-application.service';

describe('PaymentApplicationService', () => {
  let service: PaymentApplicationService;
  let prisma: any;
  let tx: any;
  let balanceService: any;
  let auditService: any;

  const payment = (overrides: any = {}) => ({
    id: 'payment-1',
    unitId: 'unit-1',
    amount: '1000.00',
    unappliedAmount: '1000.00',
    status: PaymentStatus.CONFIRMED,
    bankTransactionId: null,
    ...overrides,
  });

  const charge = (overrides: any = {}) => ({
    id: 'charge-1',
    unitId: 'unit-1',
    amount: '1000.00',
    status: UnitChargeStatus.PENDING,
    paymentApplications: [],
    ...overrides,
  });

  beforeEach(() => {
    tx = {
      payment: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation((args) => ({ id: 'payment-1', ...args.data })),
        findUniqueOrThrow: jest.fn(),
      },
      unitCharge: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation((args) => ({ id: args.where.id, ...args.data })),
        findUniqueOrThrow: jest.fn(),
      },
      paymentApplication: {
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation((args) => ({ id: 'app-new', ...args.data })),
        update: jest.fn().mockImplementation((args) => ({ id: args.where.id, ...args.data })),
      },
      bankTransaction: { update: jest.fn() },
      billingPeriod: { findUnique: jest.fn().mockResolvedValue({ status: 'OPEN' }) },
    };
    prisma = {
      $transaction: jest.fn((cb) => cb(tx)),
      payment: { findUnique: jest.fn() },
      unitCharge: { findMany: jest.fn() },
    };
    balanceService = {
      remainingChargeAmount: jest.fn().mockResolvedValue(new Decimal(0)),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    service = new PaymentApplicationService(prisma, balanceService, auditService);
  });

  describe('apply', () => {
    it('pago exacto: cubre el total del cargo y marca ambos como pagados', async () => {
      tx.payment.findUnique.mockResolvedValue(payment());
      tx.unitCharge.findUnique.mockResolvedValue(charge());
      tx.paymentApplication.findUnique.mockResolvedValue(null);

      const result = await service.apply({
        paymentId: 'payment-1',
        applications: [{ unitChargeId: 'charge-1', amount: '1000.00' }],
        userId: 'user-1',
      });

      expect(tx.unitCharge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'charge-1' },
          data: expect.objectContaining({ status: UnitChargeStatus.PAID }),
        }),
      );
      expect(tx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.APPLIED }),
        }),
      );
      expect(result.applications).toHaveLength(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT_APPLY' }),
      );
    });

    it('pago parcial: cubre solo una parte del cargo', async () => {
      tx.payment.findUnique.mockResolvedValue(payment());
      tx.unitCharge.findUnique.mockResolvedValue(charge({ amount: '1000.00' }));
      tx.paymentApplication.findUnique.mockResolvedValue(null);

      await service.apply({
        paymentId: 'payment-1',
        applications: [{ unitChargeId: 'charge-1', amount: '400.00' }],
        userId: 'user-1',
      });

      expect(tx.unitCharge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: UnitChargeStatus.PARTIALLY_PAID }),
        }),
      );
      expect(tx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.PARTIALLY_APPLIED }),
        }),
      );
    });

    it('pago mayor al cargo: el cargo queda pagado y el excedente permanece sin aplicar', async () => {
      tx.payment.findUnique.mockResolvedValue(
        payment({ amount: '1000.00', unappliedAmount: '1000.00' }),
      );
      tx.unitCharge.findUnique.mockResolvedValue(charge({ amount: '600.00' }));
      tx.paymentApplication.findUnique.mockResolvedValue(null);

      const result = await service.apply({
        paymentId: 'payment-1',
        applications: [{ unitChargeId: 'charge-1', amount: '600.00' }],
        userId: 'user-1',
      });

      expect(tx.unitCharge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: UnitChargeStatus.PAID }),
        }),
      );
      // unappliedAmount remains 400.00 -> status stays PARTIALLY_APPLIED (not APPLIED)
      const paymentUpdateArgs = tx.payment.update.mock.calls[0][0];
      expect(paymentUpdateArgs.data.status).toBe(PaymentStatus.PARTIALLY_APPLIED);
      expect(paymentUpdateArgs.data.unappliedAmount.toString()).toBe('400');
      expect(result.applications).toHaveLength(1);
    });

    it('pago para varios cargos en una sola aplicación', async () => {
      const chargeA = charge({ id: 'charge-a', amount: '300.00' });
      const chargeB = charge({ id: 'charge-b', amount: '200.00' });
      tx.payment.findUnique.mockResolvedValue(
        payment({ amount: '500.00', unappliedAmount: '500.00' }),
      );
      tx.unitCharge.findUnique.mockImplementation((args) =>
        args.where.id === 'charge-a' ? chargeA : chargeB,
      );
      tx.paymentApplication.findUnique.mockResolvedValue(null);

      const result = await service.apply({
        paymentId: 'payment-1',
        applications: [
          { unitChargeId: 'charge-a', amount: '300.00' },
          { unitChargeId: 'charge-b', amount: '200.00' },
        ],
        userId: 'user-1',
      });

      expect(result.applications).toHaveLength(2);
      expect(tx.unitCharge.update).toHaveBeenCalledTimes(2);
      const paymentUpdateArgs = tx.payment.update.mock.calls[0][0];
      expect(paymentUpdateArgs.data.status).toBe(PaymentStatus.APPLIED);
      expect(paymentUpdateArgs.data.unappliedAmount.toString()).toBe('0');
    });

    it('el pago debe estar CONFIRMED (no PENDING) antes de aplicar', async () => {
      tx.payment.findUnique.mockResolvedValue(payment({ status: PaymentStatus.PENDING }));

      await expect(
        service.apply({
          paymentId: 'payment-1',
          applications: [{ unitChargeId: 'charge-1', amount: '100.00' }],
          userId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(tx.unitCharge.findUnique).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el pago ya fue aplicado a ese mismo cargo', async () => {
      tx.payment.findUnique.mockResolvedValue(payment());
      tx.unitCharge.findUnique.mockResolvedValue(charge());
      tx.paymentApplication.findUnique.mockResolvedValue({
        id: 'existing-app',
        reversedAt: null,
      });

      await expect(
        service.apply({
          paymentId: 'payment-1',
          applications: [{ unitChargeId: 'charge-1', amount: '100.00' }],
          userId: 'user-1',
        }),
      ).rejects.toThrow(ConflictException);

      expect(tx.paymentApplication.create).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el pago ya está APPLIED/CANCELLED/REVERSED', async () => {
      tx.payment.findUnique.mockResolvedValue(payment({ status: PaymentStatus.APPLIED }));

      await expect(
        service.apply({
          paymentId: 'payment-1',
          applications: [{ unitChargeId: 'charge-1', amount: '100.00' }],
          userId: 'user-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza montos de aplicación que excedan el saldo sin aplicar del pago', async () => {
      tx.payment.findUnique.mockResolvedValue(
        payment({ amount: '100.00', unappliedAmount: '100.00' }),
      );

      await expect(
        service.apply({
          paymentId: 'payment-1',
          applications: [{ unitChargeId: 'charge-1', amount: '200.00' }],
          userId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reverseApplication', () => {
    it('reversa una aplicación y libera el saldo del pago y del cargo', async () => {
      const app = {
        id: 'app-1',
        paymentId: 'payment-1',
        unitChargeId: 'charge-1',
        amount: '400.00',
        reversedAt: null,
      };
      tx.paymentApplication.findUnique.mockResolvedValue(app);
      tx.payment.findUniqueOrThrow.mockResolvedValue(
        payment({ amount: '1000.00', unappliedAmount: '600.00' }),
      );
      tx.unitCharge.findUniqueOrThrow.mockResolvedValue(
        charge({ amount: '600.00', paymentApplications: [] }),
      );

      const result = await service.reverseApplication({
        paymentId: 'payment-1',
        unitChargeId: 'charge-1',
        reason: 'error de captura',
        userId: 'user-1',
      });

      expect(result).toEqual({ reversed: true });
      expect(tx.paymentApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: expect.objectContaining({
            reversedBy: 'user-1',
            reversalReason: 'error de captura',
          }),
        }),
      );
      const paymentUpdateArgs = tx.payment.update.mock.calls[0][0];
      // 600 + 400 = 1000 == payment.amount -> back to CONFIRMED
      expect(paymentUpdateArgs.data.status).toBe(PaymentStatus.CONFIRMED);
      expect(paymentUpdateArgs.data.unappliedAmount.toString()).toBe('1000');

      const chargeUpdateArgs = tx.unitCharge.update.mock.calls[0][0];
      expect(chargeUpdateArgs.data.status).toBe(UnitChargeStatus.PENDING);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT_APPLICATION_REVERSE' }),
      );
    });

    it('deja el pago PARTIALLY_APPLIED cuando la reversa no cubre el monto total', async () => {
      const app = {
        id: 'app-1',
        paymentId: 'payment-1',
        unitChargeId: 'charge-1',
        amount: '200.00',
        reversedAt: null,
      };
      tx.paymentApplication.findUnique.mockResolvedValue(app);
      tx.payment.findUniqueOrThrow.mockResolvedValue(
        payment({ amount: '1000.00', unappliedAmount: '300.00' }),
      );
      tx.unitCharge.findUniqueOrThrow.mockResolvedValue(
        charge({ amount: '800.00', paymentApplications: [{ id: 'other', amount: '300.00' }] }),
      );

      await service.reverseApplication({
        paymentId: 'payment-1',
        unitChargeId: 'charge-1',
        reason: 'ajuste',
        userId: 'user-1',
      });

      const paymentUpdateArgs = tx.payment.update.mock.calls[0][0];
      // 300 + 200 = 500 != 1000 -> stays PARTIALLY_APPLIED
      expect(paymentUpdateArgs.data.status).toBe(PaymentStatus.PARTIALLY_APPLIED);
    });

    it('lanza NotFoundException si la aplicación no existe o ya fue reversada', async () => {
      tx.paymentApplication.findUnique.mockResolvedValue(null);

      await expect(
        service.reverseApplication({
          paymentId: 'payment-1',
          unitChargeId: 'charge-1',
          reason: 'x',
          userId: 'user-1',
        }),
      ).rejects.toThrow('Active application not found');
    });
  });

  describe('dos pagos / concurrencia', () => {
    it('dos pagos pueden cubrir el mismo cargo (segundo pago ve remanente)', async () => {
      tx.payment.findUnique.mockResolvedValue(
        payment({ id: 'payment-2', amount: '400.00', unappliedAmount: '400.00' }),
      );
      tx.unitCharge.findUnique.mockResolvedValue(
        charge({
          amount: '1000.00',
          status: UnitChargeStatus.PARTIALLY_PAID,
          paymentApplications: [{ id: 'app-1', amount: '600.00', reversedAt: null }],
        }),
      );
      tx.paymentApplication.findUnique.mockResolvedValue(null);

      await service.apply({
        paymentId: 'payment-2',
        applications: [{ unitChargeId: 'charge-1', amount: '400.00' }],
        userId: 'user-1',
      });

      expect(tx.unitCharge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: UnitChargeStatus.PAID }),
        }),
      );
    });

    it('concurrencia: si otra tx ya aplicó el mismo par, ConflictException', async () => {
      tx.payment.findUnique.mockResolvedValue(payment());
      tx.unitCharge.findUnique.mockResolvedValue(charge());
      tx.paymentApplication.findUnique.mockResolvedValue({
        id: 'app-existing',
        paymentId: 'payment-1',
        unitChargeId: 'charge-1',
        amount: '100.00',
        reversedAt: null,
      });

      await expect(
        service.apply({
          paymentId: 'payment-1',
          applications: [{ unitChargeId: 'charge-1', amount: '100.00' }],
          userId: 'user-1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
