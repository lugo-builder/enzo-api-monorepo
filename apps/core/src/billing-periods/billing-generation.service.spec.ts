import {
  BillingPeriodStatus,
  ChargeTypeStatus,
  ResidentialUnitStatus,
} from '@prisma/client';

import { BillingGenerationService } from './billing-generation.service';

describe('BillingGenerationService', () => {
  let service: BillingGenerationService;
  let prisma: any;
  let auditService: any;

  const period = {
    id: 'period-1',
    residentialComplexId: 'condo-1',
    year: 2026,
    month: 7,
    dueDate: new Date('2026-07-10T00:00:00Z'),
    status: BillingPeriodStatus.DRAFT,
  };

  const units = [
    {
      id: 'unit-1',
      unitNumber: '101',
      residentialComplexId: 'condo-1',
      status: ResidentialUnitStatus.ACTIVE,
      deletedAt: null,
    },
  ];

  const chargeTypes = [
    {
      id: 'charge-type-1',
      code: 'MAINT',
      name: 'Mantenimiento ordinario',
      residentialComplexId: 'condo-1',
      status: ChargeTypeStatus.ACTIVE,
      isRecurring: true,
      defaultAmount: null,
    },
  ];

  beforeEach(() => {
    prisma = {
      billingPeriod: {
        findUnique: jest.fn().mockResolvedValue(period),
        update: jest.fn().mockResolvedValue({ ...period, status: BillingPeriodStatus.GENERATED }),
      },
      residentialUnit: { findMany: jest.fn().mockResolvedValue(units) },
      chargeType: {
        findMany: jest.fn().mockResolvedValue(chargeTypes),
        findUnique: jest.fn().mockResolvedValue(chargeTypes[0]),
      },
      recurringChargeConfig: { findFirst: jest.fn() },
      unitCharge: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'charge-1' }),
      },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    service = new BillingGenerationService(prisma, auditService);
  });

  it('genera una cuota ordinaria a partir de un RecurringChargeConfig vigente', async () => {
    prisma.recurringChargeConfig.findFirst.mockResolvedValue({
      amount: '850.00',
    });

    const result = await service.generate(
      'period-1',
      { confirm: true } as any,
      'user-1',
    );

    expect(prisma.unitCharge.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.unitCharge.create.mock.calls[0][0].data;
    expect(createArgs.unitId).toBe('unit-1');
    expect(createArgs.chargeTypeId).toBe('charge-type-1');
    expect(createArgs.amount.toString()).toBe('850');
    expect(result.preview).toBe(false);
    expect(result.proposed).toHaveLength(1);
    expect(result.proposed[0].amount).toBe('850.00');
    expect(prisma.billingPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'period-1' },
        data: expect.objectContaining({ status: BillingPeriodStatus.GENERATED }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BILLING_PERIOD_GENERATE' }),
    );
  });

  it('usa defaultAmount del ChargeType cuando no hay RecurringChargeConfig vigente', async () => {
    prisma.recurringChargeConfig.findFirst.mockResolvedValue(null);
    prisma.chargeType.findUnique.mockResolvedValue({
      ...chargeTypes[0],
      defaultAmount: '500.00',
    });

    const result = await service.generate(
      'period-1',
      { confirm: true } as any,
      'user-1',
    );

    expect(prisma.unitCharge.create).toHaveBeenCalledTimes(1);
    expect(result.proposed[0].amount).toBe('500.00');
  });

  it('reporta error cuando no hay RecurringChargeConfig ni defaultAmount', async () => {
    prisma.recurringChargeConfig.findFirst.mockResolvedValue(null);
    prisma.chargeType.findUnique.mockResolvedValue({
      ...chargeTypes[0],
      defaultAmount: null,
    });

    const result = await service.generate(
      'period-1',
      { confirm: true } as any,
      'user-1',
    );

    expect(prisma.unitCharge.create).not.toHaveBeenCalled();
    expect(result.summary.failed).toBe(1);
    expect(result.errors[0].code).toBe('MISSING_RECURRING_AMOUNT');
  });

  it('idempotencia: si ya existe un cargo para la unidad/periodo/chargeType, se omite', async () => {
    prisma.recurringChargeConfig.findFirst.mockResolvedValue({ amount: '850.00' });
    prisma.unitCharge.findFirst.mockResolvedValue({ id: 'existing-charge' });

    const result = await service.generate(
      'period-1',
      { confirm: true } as any,
      'user-1',
    );

    expect(prisma.unitCharge.create).not.toHaveBeenCalled();
    expect(result.proposed).toHaveLength(0);
    expect(result.summary.processed).toBe(0);
  });

  it('preview (confirm=false) no persiste cargos ni actualiza el periodo', async () => {
    prisma.recurringChargeConfig.findFirst.mockResolvedValue({ amount: '850.00' });

    const result = await service.generate('period-1', {} as any, 'user-1');

    expect(result.preview).toBe(true);
    expect(result.proposed).toHaveLength(1);
    expect(prisma.unitCharge.create).not.toHaveBeenCalled();
    expect(prisma.billingPeriod.update).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('confirm=true persiste los cargos y marca el periodo como GENERATED', async () => {
    prisma.recurringChargeConfig.findFirst.mockResolvedValue({ amount: '850.00' });

    const result = await service.generate(
      'period-1',
      { confirm: true } as any,
      'user-1',
    );

    expect(result.preview).toBe(false);
    expect(prisma.unitCharge.create).toHaveBeenCalledTimes(1);
    expect(prisma.billingPeriod.update).toHaveBeenCalledTimes(1);
  });
});
