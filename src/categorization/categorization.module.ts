import { Module } from '@nestjs/common';
import { CategorizationService } from './categorization.service';
import { CategorizationController } from './categorization.controller';
import { TestStreamService } from './test-stream';
import { ConfigModule } from '@nestjs/config';

@Module({
  providers: [ConfigModule, CategorizationService, TestStreamService],
  controllers: [CategorizationController],
  exports: [CategorizationService, TestStreamService],
})
export class CategorizationModule {}
