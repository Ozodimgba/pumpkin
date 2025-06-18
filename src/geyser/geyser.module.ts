import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MetaModule } from '../meta/meta.module';
import { GeyserService } from './geyser.service';
import { ConfigModule } from '@nestjs/config';
import { GeyserController } from './geyser.controller';
import { CategorizationModule } from '../categorization/categorization.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    MetaModule,
    ConfigModule,
    CategorizationModule,
  ],
  providers: [GeyserService],
  exports: [GeyserService],
  controllers: [GeyserController],
})
export class GeyserModule {}
