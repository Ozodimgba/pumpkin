import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateTokenDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  imageUrl: string; // URL to the image file

  @IsString()
  @IsOptional()
  twitter?: string;

  @IsString()
  @IsOptional()
  telegram?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsNotEmpty()
  creatorPrivateKey: string; // Base58 encoded private key

  @IsString()
  @IsOptional()
  buyAmountSol?: string; // Amount in SOL to buy initially (optional)

  @IsString()
  @IsOptional()
  slippageBasisPoints?: string; // Default: 500 (5%)
}
