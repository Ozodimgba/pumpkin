import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SellTokenDto {
  @IsString()
  @IsNotEmpty()
  mint: string; // Token mint address

  @IsString()
  @IsNotEmpty()
  sellerPrivateKey: string; // Base58 encoded private key

  @IsString()
  @IsNotEmpty()
  sellTokenAmount: string; // Amount of tokens to sell (in token units)

  @IsString()
  @IsOptional()
  slippageBasisPoints?: string; // Default: 500 (5%)

  @IsString()
  @IsOptional()
  priorityFeeMicroLamports?: string; // Priority fee in micro lamports
}
