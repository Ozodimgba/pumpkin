import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class BuyTokenDto {
  @IsString()
  @IsNotEmpty()
  mint: string; // Token mint address

  @IsString()
  @IsNotEmpty()
  buyerPrivateKey: string; // Base58 encoded private key

  @IsString()
  @IsNotEmpty()
  buyAmountSol: string; // Amount in SOL to spend

  @IsString()
  @IsOptional()
  slippageBasisPoints?: string; // Default: 500 (5%)

  @IsString()
  @IsOptional()
  priorityFeeMicroLamports?: string; // Priority fee in micro lamports
}
