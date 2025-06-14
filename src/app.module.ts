import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PumpFunModule } from './pumpfun/pumpfun.module';

@Module({
  imports: [PumpFunModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
