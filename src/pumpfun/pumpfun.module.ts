import { Module } from '@nestjs/common';
import { PumpFunController } from './pumpfun.controller';
import { PumpFunService } from './pumpfun.service';

@Module({
  controllers: [PumpFunController],
  providers: [PumpFunService],
  exports: [PumpFunService],
})
export class PumpFunModule {}
