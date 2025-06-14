// metadata.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  findMetadataPda,
  fetchMetadata,
  Metadata,
} from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';

export interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
  mint: string;
  updateAuthority: string;
  isMutable: boolean;
  primarySaleHappened: boolean;
  sellerFeeBasisPoints: number;
  creators?: Array<{
    address: string;
    verified: boolean;
    share: number;
  }>;
  // off-chain metadata (if fetched from URI)
  offChainMetadata?: {
    description?: string;
    image?: string;
    external_url?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
    [key: string]: any;
  };
}

interface OffChainMetadata {
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  [key: string]: unknown; // Use unknown instead of any for better type safety
}

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);
  private readonly defaultRpcUrl =
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  async getTokenMetadata(
    mintAddress: string,
    rpcUrl: string = this.defaultRpcUrl,
    includeOffChainMetadata: boolean = false,
    commitment: 'processed' | 'confirmed' | 'finalized' = 'processed',
  ): Promise<TokenMetadata | null> {
    try {
      // Create UMI instance
      const umi = createUmi(rpcUrl, {
        commitment: commitment,
      });

      // Convert mint address to UMI public key
      const mint = publicKey(mintAddress);

      // Find the metadata PDA
      const metadataPda = findMetadataPda(umi, { mint });

      // Fetch the metadata account
      const metadata: Metadata = await fetchMetadata(umi, metadataPda);

      // Extract basic metadata
      const tokenMetadata: TokenMetadata = {
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        mint: mintAddress,
        updateAuthority: metadata.updateAuthority.toString(),
        isMutable: metadata.isMutable,
        primarySaleHappened: metadata.primarySaleHappened,
        sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
      };

      if (includeOffChainMetadata && metadata.uri) {
        try {
          const response = await fetch(metadata.uri);
          if (response.ok) {
            const offChainData = (await response.json()) as OffChainMetadata;
            tokenMetadata.offChainMetadata = offChainData;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Failed to fetch off-chain metadata: ${errorMessage}`,
          );
        }
      }

      return tokenMetadata;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching token metadata: ${errorMessage}`);
      return null;
    }
  }

  async getPumpFunTokenMetadata(
    mintAddress: string,
    rpcUrl: string = this.defaultRpcUrl,
  ): Promise<TokenMetadata | null> {
    // Try different commitment levels in order
    const commitmentLevels: ('processed' | 'confirmed' | 'finalized')[] = [
      'processed',
      'confirmed',
      'finalized',
    ];

    for (const commitment of commitmentLevels) {
      try {
        this.logger.debug(
          `Trying commitment level: ${commitment} for ${mintAddress}`,
        );
        const metadata = await this.getTokenMetadata(
          mintAddress,
          rpcUrl,
          true,
          commitment,
        );
        if (metadata) {
          this.logger.debug(
            `Found metadata with commitment: ${commitment} for ${mintAddress}`,
          );
          return metadata;
        }
      } catch (error) {
        console.log(error);
        this.logger.debug(
          `Failed with commitment ${commitment} for ${mintAddress}`,
        );
        continue;
      }
    }

    return null;
  }

  async metadataAccountExists(
    mintAddress: string,
    rpcUrl: string = this.defaultRpcUrl,
    commitment: 'processed' | 'confirmed' | 'finalized' = 'processed',
  ): Promise<boolean> {
    try {
      const umi = createUmi(rpcUrl, { commitment });
      const mint = publicKey(mintAddress);
      const metadataPda = findMetadataPda(umi, { mint });

      // Try to fetch just the account info without parsing
      const account = await umi.rpc.getAccount(metadataPda[0]);
      return account.exists;
    } catch (error: any) {
      console.log(error);
      return false;
    }
  }
}
