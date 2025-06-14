import { Test, TestingModule } from '@nestjs/testing';
import { PumpfunController } from './pumpfun.controller';

describe('PumpfunController', () => {
  let controller: PumpfunController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PumpfunController],
    }).compile();

    controller = module.get<PumpfunController>(PumpfunController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
