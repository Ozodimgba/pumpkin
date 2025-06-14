import { Controller, Get, Param } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GeyserService } from './geyser.service';
import { MetadataQueryService } from '../meta/metadata-query.service';
import { MetadataService } from '../meta/metadata.service';

@Controller('geyser')
export class GeyserController {
  constructor(
    private readonly geyserService: GeyserService,
    private readonly metadataQueryService: MetadataQueryService,
    private readonly metadataService: MetadataService,
  ) {}

  @Get('stats')
  getCacheStats() {
    return this.geyserService.getCacheStats();
  }

  @Get('summary')
  getTokenSummary() {
    return this.geyserService.getTokenSummary();
  }

  @Get('search/:term')
  searchTokens(@Param('term') term: string) {
    return this.geyserService.searchTokens(term);
  }

  //   @Get('recent/:minutes?')
  //   getRecentTokens(@Param('minutes') minutes?: string) {
  //     const minutesAgo = minutes ? parseInt(minutes) : 60;
  //     console.log(minutesAgo);
  //     return this.geyserService.getRecentTokens();
  //   }

  @Get('all')
  getAllTokens() {
    return this.geyserService.getAllTokens();
  }

  @Get('symbol/:symbol')
  getBySymbol(@Param('symbol') symbol: string) {
    return this.metadataQueryService.getBySymbol(symbol);
  }

  @Get('mint/:mintAddress')
  async getByMint(@Param('mintAddress') mintAddress: string) {
    // First check cache
    const cached = this.metadataQueryService.getByMint(mintAddress);
    if (cached && !cached.failed) {
      return cached;
    }

    // If not in cache or failed, try to fetch fresh
    const metadata =
      await this.metadataService.getPumpFunTokenMetadata(mintAddress);
    return metadata;
  }

  @Get('characteristics')
  getByCharacteristics() {
    // Example: Get tokens with images and descriptions
    return this.metadataQueryService.getByCharacteristics({
      hasImage: true,
      hasDescription: true,
    });
  }

  // Event listeners for when new mints are detected
  @OnEvent('pumpfun.mint.detected')
  handleMintDetected(payload: any) {
    console.log('New mint detected:', payload);
    // You can add your custom logic here
    // e.g., save to database, send notifications, etc.
  }

  @OnEvent('pumpfun.metadata.found')
  handleMetadataFound(payload: { mintAddress: string; metadata: any }) {
    console.log('Metadata found for:', payload.mintAddress);
    // You can add your custom logic here
    // e.g., update database with metadata, trigger alerts, etc.
  }
}
