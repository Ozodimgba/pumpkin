import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PumpFunModule } from './pumpfun/pumpfun.module';
import { GeyserModule } from './geyser/geyser.module';
import { MetaModule } from './meta/meta.module';
import { ConfigModule } from '@nestjs/config';
import { CategorizationModule } from './categorization/categorization.module';

@Module({
  imports: [
    PumpFunModule,
    GeyserModule,
    MetaModule,
    ConfigModule.forRoot({ isGlobal: true }),
    CategorizationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
