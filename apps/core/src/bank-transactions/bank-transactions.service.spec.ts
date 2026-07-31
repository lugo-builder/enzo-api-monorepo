import { BankTransactionsService } from './bank-transactions.service';

describe('BankTransactionsService', () => {
  let service: BankTransactionsService;
  let prisma: any;
  let auditService: any;

  beforeEach(() => {
    prisma = {
      residentialComplex: { findFirst: jest.fn() },
      bankTransaction: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    service = new BankTransactionsService(prisma, auditService);
  });

  describe('import duplicados', () => {
    it('omite filas con el mismo sourceHash (transacción duplicada)', async () => {
      prisma.residentialComplex.findFirst.mockResolvedValue({ id: 'condo-1' });
      prisma.bankTransaction.findFirst.mockResolvedValue({
        id: 'existing-tx',
        sourceHash: 'abc',
      });

      const csv = Buffer.from(
        [
          'transactionDate,amount,bankReference,concept,senderName',
          '2026-01-15,500.00,REF-1,Hydra 9,Juan',
        ].join('\n'),
      );

      const result = await service.importFromFile('condo-1', csv, 'user-1');

      expect(prisma.bankTransaction.create).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
      expect(result.summary.processed).toBe(0);
      expect(result.summary.total).toBe(1);
    });

    it('crea fila cuando no hay duplicado', async () => {
      prisma.residentialComplex.findFirst.mockResolvedValue({ id: 'condo-1' });
      prisma.bankTransaction.findFirst.mockResolvedValue(null);
      prisma.bankTransaction.create.mockResolvedValue({
        id: 'tx-new',
        amount: '500.00',
      });

      const csv = Buffer.from(
        [
          'transactionDate,amount,bankReference,concept,senderName',
          '2026-01-15,500.00,REF-2,Hydra 10,Maria',
        ].join('\n'),
      );

      const result = await service.importFromFile('condo-1', csv, 'user-1');

      expect(prisma.bankTransaction.create).toHaveBeenCalledTimes(1);
      expect(result.summary.processed).toBe(1);
      expect(result.skipped).toBe(0);
    });
  });
});
