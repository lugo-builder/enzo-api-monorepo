import { Test, TestingModule } from '@nestjs/testing';
import { ErpOrdersService } from './erp-orders.service';

describe('ErpOrdersService', () => {
  let service: ErpOrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErpOrdersService],
    }).compile();

    service = module.get<ErpOrdersService>(ErpOrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
