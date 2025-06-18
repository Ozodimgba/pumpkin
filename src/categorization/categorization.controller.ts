import { Controller, Get, Post, Body } from '@nestjs/common';
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
}
