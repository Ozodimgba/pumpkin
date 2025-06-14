import { Module } from '@nestjs/common';
import { MetadataCacheService } from './meta.service';
import { MetadataService } from './metadata.service';
import { ConfigModule } from '@nestjs/config';
import { MetadataQueryService } from './metadata-query.service';

@Module({
  imports: [ConfigModule],
  providers: [MetadataCacheService, MetadataService, MetadataQueryService],
  exports: [MetadataCacheService, MetadataService, MetadataQueryService],
})
export class MetaModule {}
