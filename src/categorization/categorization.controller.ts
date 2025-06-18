import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CategorizationService } from './categorization.service';
import { TokenStreamDto } from './categorization.dto';
import { TestStreamService } from './test-stream';

@Controller('categorization')
export class CategorizationController {
  constructor(
    private readonly categorizationService: CategorizationService,
    private testStreamService: TestStreamService,
  ) {}

  @Post('process-token')
  async processToken(@Body() token: TokenStreamDto) {
    await this.categorizationService.processTokenStream(token);
    return { status: 'queued' };
  }

  @Post('start')
  startStream(@Body() { interval }: { interval?: number }) {
    this.testStreamService.startFakeStream(interval || 2000);
    return {
      status: 'started',
      interval: interval || 2000,
      message: 'Fake token stream started',
    };
  }

  @Get('trends')
  getTopTrends() {
    return this.categorizationService.getTop10MetaTrends();
  }

  @Get('stats')
  getStats() {
    return this.categorizationService.getCategoryStats();
  }

  @Post('add-category')
  addCategory(@Body() { category }: { category: string }) {
    this.categorizationService.addCategory(category);
    return { status: 'added', category };
  }

  @Get('live-feed')
  getLiveFeed() {
    return {
      message: 'Live categorization feed from pump.fun tokens',
      trends: this.categorizationService.getTop10MetaTrends(),
      bufferSize: this.categorizationService.getCategoryStats().bufferSize,
      totalProcessed: this.categorizationService.getCategoryStats().totalTokens,
    };
  }

  @Get('recent-examples/:category')
  getRecentExamples(@Param('category') category: string) {
    return this.categorizationService.getCategoryMetadata(category);
  }
}
