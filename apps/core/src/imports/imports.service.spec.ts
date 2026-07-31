import { BadRequestException } from '@nestjs/common';
import { ImportBatchType } from '@prisma/client';

import { ImportsService } from './imports.service';

describe('ImportsService.uploadFromJson', () => {
  let service: ImportsService;
  let prisma: any;
  let auditService: any;
  let validationService: any;

  beforeEach(() => {
    prisma = {
      residentialComplex: { findFirst: jest.fn() },
      importBatch: { create: jest.fn() },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    validationService = {};
    service = new ImportsService(prisma, auditService, validationService);
  });

  it('crea un batch desde un arreglo JSON de residentes', async () => {
    prisma.residentialComplex.findFirst.mockResolvedValue({ id: 'condo-1' });
    prisma.importBatch.create.mockResolvedValue({
      id: 'batch-1',
      type: ImportBatchType.RESIDENTS,
      totalRows: 2,
      status: 'UPLOADED',
    });

    const rows = [
      { unitNumber: '1', firstName: 'Juan', lastName: 'Pérez' },
      { unitNumber: '2', firstName: 'María', lastName: 'López' },
    ];

    const batch = await service.uploadFromJson(
      'condo-1',
      ImportBatchType.RESIDENTS,
      rows,
      'user-1',
    );

    expect(batch.id).toBe('batch-1');
    expect(prisma.importBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          residentialComplexId: 'condo-1',
          type: ImportBatchType.RESIDENTS,
          totalRows: 2,
          previewData: rows,
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IMPORT_UPLOAD',
        newData: expect.objectContaining({ source: 'JSON', totalRows: 2 }),
      }),
    );
  });

  it('rechaza rows vacío', async () => {
    await expect(
      service.uploadFromJson('condo-1', ImportBatchType.RESIDENTS, [], 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
