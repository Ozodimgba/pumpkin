import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsObject,
} from 'class-validator';

export class CreateTokenDto {
  @IsString()
  name: string;

  @IsString()
  symbol: string;

  @IsString()
  uri: string;

  @IsString()
  mint: string;

  @IsString()
  updateAuthority: string;

  @IsBoolean()
  isMutable: boolean;

  @IsBoolean()
  primarySaleHappened: boolean;

  @IsNumber()
  sellerFeeBasisPoints: number;

  @IsOptional()
  @IsObject()
  offChainMetadata?: any;

  @IsOptional()
  @IsString()
  category?: string;
}

export class TrendQueryDto {
  @IsOptional()
  @IsString()
  timeWindow?: '10min' | '1hr' | '6hr' | '1day';

  @IsOptional()
  @IsNumber()
  limit?: number = 10;
}
