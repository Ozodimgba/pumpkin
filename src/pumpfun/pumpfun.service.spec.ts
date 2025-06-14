import { Test, TestingModule } from '@nestjs/testing';
import { PumpfunService } from './pumpfun.service';

describe('PumpfunService', () => {
  let service: PumpfunService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PumpfunService],
    }).compile();

    service = module.get<PumpfunService>(PumpfunService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
