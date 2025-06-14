// src/pumpfun/pumpfun.controller.ts
import { Controller, Post, Get, Body, Param, HttpCode } from '@nestjs/common';
import { PumpFunService } from './pumpfun.service';
import { CreateTokenDto } from './dto/create-token.dto';
import { BuyTokenDto } from './dto/buy-token.dto';
import { SellTokenDto } from './dto/sell-token.dto';

@Controller('pumpfun')
export class PumpFunController {
  constructor(private readonly pumpFunService: PumpFunService) {}

  @Post('create')
  @HttpCode(200)
  async createToken(@Body() createTokenDto: CreateTokenDto) {
    return this.pumpFunService.createToken(createTokenDto);
  }

  @Post('create-only')
  @HttpCode(200)
  async createTokenOnly(@Body() createTokenDto: CreateTokenDto) {
    return this.pumpFunService.createTokenOnly(createTokenDto);
  }

  @Post('buy')
  @HttpCode(200)
  async buyToken(@Body() buyTokenDto: BuyTokenDto) {
    return this.pumpFunService.buyToken(buyTokenDto);
  }

  @Post('sell')
  @HttpCode(200)
  async sellToken(@Body() sellTokenDto: SellTokenDto) {
    return this.pumpFunService.sellToken(sellTokenDto);
  }

  @Get('token/:mint')
  async getTokenInfo(@Param('mint') mint: string) {
    return this.pumpFunService.getTokenInfo(mint);
  }
}
