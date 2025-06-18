import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Client, {
  CommitmentLevel,
  SubscribeRequest,
  SubscribeUpdate,
  SubscribeUpdateTransaction,
} from '@triton-one/yellowstone-grpc';
import { ClientDuplexStream } from '@grpc/grpc-js';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { MetadataCacheService } from '../meta/meta.service';
import { MetadataService } from '../meta/metadata.service';
import { MetadataQueryService } from '../meta/metadata-query.service';
import { CategorizationService } from '../categorization/categorization.service';
import { TokenMetadata } from 'src/meta/meta.types';

// Keep all your existing interfaces
interface CompiledInstruction {
  programIdIndex: number;
  accounts: Uint8Array;
  data: Uint8Array;
}

interface Message {
  header: MessageHeader | undefined;
  accountKeys: Uint8Array[];
  recentBlockhash: Uint8Array;
  instructions: CompiledInstruction[];
  versioned: boolean;
  addressTableLookups: MessageAddressTableLookup[];
}

interface MessageHeader {
  numRequiredSignatures: number;
  numReadonlySignedAccounts: number;
  numReadonlyUnsignedAccounts: number;
}

interface MessageAddressTableLookup {
  accountKey: Uint8Array;
  writableIndexes: Uint8Array;
  readonlyIndexes: Uint8Array;
}

interface FormattedTransactionData {
  signature: string;
  slot: string;
  [accountName: string]: string;
}

@Injectable()
export class GeyserService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GeyserService.name);
  private client: Client;
  private stream: ClientDuplexStream<SubscribeRequest, SubscribeUpdate>;
  private statsInterval: NodeJS.Timeout;
  private tokenMap = new Map<string, any>();

  private readonly PUMP_FUN_PROGRAM_ID =
    '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
  private readonly PUMP_FUN_MINT_AUTHORITY =
    'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM';
  private readonly PUMP_FUN_CREATE_IX_DISCRIMINATOR = Buffer.from([
    24, 30, 200, 40, 5, 28, 7, 119,
  ]);
  private readonly COMMITMENT = CommitmentLevel.PROCESSED;

  private readonly FILTER_CONFIG = {
    programIds: [this.PUMP_FUN_PROGRAM_ID],
    requiredAccounts: [this.PUMP_FUN_PROGRAM_ID, this.PUMP_FUN_MINT_AUTHORITY],
    instructionDiscriminators: [this.PUMP_FUN_CREATE_IX_DISCRIMINATOR],
  };

  private readonly ACCOUNTS_TO_INCLUDE = [
    {
      name: 'mint',
      index: 0,
    },
  ];

  constructor(
    private eventEmitter: EventEmitter2,
    private metadataCache: MetadataCacheService,
    private metadataService: MetadataService,
    private configService: ConfigService,
    private queryService: MetadataQueryService,
    private categorizationService: CategorizationService,
  ) {}

  async onModuleInit() {
    await this.initialize();
  }

  onModuleDestroy() {
    this.cleanup();
  }

  private async initialize(): Promise<void> {
    const ENDPOINT = this.configService.get<string>('YELLOWSTONE_ENDPOINT');
    const TOKEN = this.configService.get<string>('YELLOWSTONE_TOKEN');

    if (!ENDPOINT || !TOKEN) {
      this.logger.error(
        'YELLOWSTONE_ENDPOINT and YELLOWSTONE_TOKEN must be set in environment variables',
      );
      throw new Error('Missing required environment variables');
    }

    this.client = new Client(ENDPOINT, TOKEN, {});
    this.stream = await this.client.subscribe();
    const request = this.createSubscribeRequest();

    try {
      await this.sendSubscribeRequest(this.stream, request);
      this.logger.log(
        'Geyser connection established - watching new Pump.fun mints',
      );
      this.logger.log(
        'Using metadata cache for faster lookups and reduced API calls',
      );

      // Setup cache stats logging
      this.statsInterval = setInterval(
        () => {
          const stats = this.metadataCache.getStats();
          // Uncomment if you want periodic logging
          this.logger.log(
            `Cache Stats: ${stats.successfulEntries} successful, ${stats.failedEntries} failed, ${stats.pendingFetches} pending`,
          );
        },
        5 * 60 * 1000,
      );

      this.handleStreamEvents(this.stream).catch((error) => {
        this.logger.error('Stream handling error:', error);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Error in subscription process:', errorMessage);
      this.stream?.end();
      throw error;
    }
  }

  private cleanup(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    if (this.stream) {
      this.stream.end();
    }
  }

  getTokensFromMap(): any[] {
    return Array.from(this.tokenMap.values());
  }

  // All your existing helper methods (unchanged)
  private createSubscribeRequest(): SubscribeRequest {
    return {
      accounts: {},
      slots: {},
      transactions: {
        pumpFun: {
          accountInclude: [],
          accountExclude: [],
          accountRequired: this.FILTER_CONFIG.requiredAccounts,
        },
      },
      transactionsStatus: {},
      entry: {},
      blocks: {},
      blocksMeta: {},
      commitment: this.COMMITMENT,
      accountsDataSlice: [],
      ping: undefined,
    };
  }

  private sendSubscribeRequest(
    stream: ClientDuplexStream<SubscribeRequest, SubscribeUpdate>,
    request: SubscribeRequest,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      stream.write(request, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private handleStreamEvents(
    stream: ClientDuplexStream<SubscribeRequest, SubscribeUpdate>,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      stream.on('data', (data) => this.handleData(data));
      stream.on('error', (error: Error) => {
        this.logger.error('Stream error:', error);
        reject(error);
        stream.end();
      });
      stream.on('end', () => {
        this.logger.log('Stream ended');
        resolve();
      });
      stream.on('close', () => {
        this.logger.log('Stream closed');
        resolve();
      });
    });
  }

  private handleData(data: SubscribeUpdate): void {
    if (
      !this.isSubscribeUpdateTransaction(data) ||
      !data.filters.includes('pumpFun')
    ) {
      return;
    }

    const transaction = data.transaction?.transaction;
    const message = transaction?.transaction?.message;

    if (!transaction || !message) {
      return;
    }

    const matchingInstruction = message.instructions.find((ix) =>
      this.matchesInstructionDiscriminator(ix),
    );
    if (!matchingInstruction) {
      return;
    }

    const formattedSignature = this.convertSignature(transaction.signature);
    const formattedData = this.formatData(
      message,
      formattedSignature.base58,
      data.transaction.slot,
    );

    if (formattedData) {
      // Emit event for other parts of your application to listen to
      this.eventEmitter.emit('pumpfun.mint.detected', formattedData);

      if (formattedData.mint) {
        this.fetchMetadataWithRetry(formattedData.mint);
      }
    }
  }

  private async fetchMetadataWithRetry(
    mintAddress: string,
    maxRetries: number = 3,
    delayMs: number = 2000,
  ): Promise<void> {
    // Check if already in cache
    const cached = this.metadataCache.get(mintAddress);
    if (cached && !cached.failed) {
      // Emit event with cached metadata
      this.eventEmitter.emit('pumpfun.metadata.found', {
        mintAddress,
        metadata: cached,
      });
      return;
    }

    // Check if we should retry this mint
    if (!this.metadataCache.shouldRetry(mintAddress)) {
      return;
    }

    // Check if already being fetched
    if (this.metadataCache.isFetching(mintAddress)) {
      return;
    }

    this.metadataCache.markFetching(mintAddress);

    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Add delay before retry attempts
          if (attempt > 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          // Check if metadata account exists to avoid unnecessary attempts
          const exists =
            await this.metadataService.metadataAccountExists(mintAddress);
          if (!exists) {
            if (attempt === maxRetries) {
              this.logger.warn(
                `No metadata found after ${maxRetries} attempts for ${mintAddress}`,
              );
              this.metadataCache.markFailedAttempt(mintAddress);
            }
            continue;
          }

          // Try to fetch the metadata
          const metadata =
            await this.metadataService.getPumpFunTokenMetadata(mintAddress);

          if (metadata) {
            // Cache the successful result
            this.metadataCache.set(mintAddress, metadata);

            // Emit event with new metadata
            this.eventEmitter.emit('pumpfun.metadata.found', {
              mintAddress,
              metadata,
            });

            await this.sendToCategorization(metadata);
            return; // Success, exit the retry loop
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Attempt ${attempt}: Unexpected error for ${mintAddress}: ${errorMessage}`,
          );
        }

        // Show retry status only if not the last attempt
        if (attempt < maxRetries) {
          this.logger.debug(
            `Retrying in ${delayMs / 1000}s... (${attempt}/${maxRetries}) for ${mintAddress}`,
          );
        }
      }

      // Mark as failed if we get here
      this.logger.warn(`No metadata available for token ${mintAddress}`);
      this.metadataCache.markFailedAttempt(mintAddress);
    } finally {
      this.metadataCache.markFetchCompleted(mintAddress);
    }
  }

  private async sendToCategorization(metadata: TokenMetadata): Promise<void> {
    try {
      // Create token stream DTO from metadata
      const tokenStreamDto = {
        name: metadata.symbol || metadata.name || 'UNKNOWN',
        description: metadata.offChainMetadata?.description || undefined,
        timestamp: new Date(),
        mint: metadata.mint,
      };

      // Send to categorization service
      await this.categorizationService.processTokenStream(tokenStreamDto);

      this.logger.debug(
        `Sent token ${tokenStreamDto.name} to categorization service`,
      );
    } catch (error) {
      this.logger.error(`Failed to send token to categorization: ${error}`);
    }
  }

  private isSubscribeUpdateTransaction(
    data: SubscribeUpdate,
  ): data is SubscribeUpdate & { transaction: SubscribeUpdateTransaction } {
    return (
      'transaction' in data &&
      typeof data.transaction === 'object' &&
      data.transaction !== null &&
      'slot' in data.transaction &&
      'transaction' in data.transaction
    );
  }

  private convertSignature(signature: Uint8Array): { base58: string } {
    return { base58: bs58.encode(Buffer.from(signature)) };
  }

  private formatData(
    message: Message,
    signature: string,
    slot: string,
  ): FormattedTransactionData | undefined {
    const matchingInstruction = message.instructions.find((ix) =>
      this.matchesInstructionDiscriminator(ix),
    );

    if (!matchingInstruction) {
      return undefined;
    }

    const accountKeys = message.accountKeys;
    const includedAccounts = this.ACCOUNTS_TO_INCLUDE.reduce<
      Record<string, string>
    >((acc, { name, index }) => {
      const accountIndex = matchingInstruction.accounts[index];
      const publicKey = accountKeys[accountIndex];
      acc[name] = new PublicKey(publicKey).toBase58();
      return acc;
    }, {});

    return {
      signature,
      slot,
      ...includedAccounts,
    };
  }

  private matchesInstructionDiscriminator(ix: CompiledInstruction): boolean {
    return (
      ix?.data &&
      this.FILTER_CONFIG.instructionDiscriminators.some((discriminator) =>
        Buffer.from(discriminator).equals(ix.data.slice(0, 8)),
      )
    );
  }

  public getQuery() {
    return this.queryService.getQueryInterface();
  }

  public getCache() {
    return this.metadataCache;
  }

  public getCacheStats() {
    return this.metadataCache.getStats();
  }

  public searchTokens(term: string) {
    return this.queryService.search(term);
  }

  public getRecentTokens(minutesAgo?: number) {
    return this.queryService.getRecent(minutesAgo);
  }

  public getAllTokens() {
    return this.queryService.getAllSuccessful();
  }

  public getTokenSummary() {
    return this.queryService.getSummary();
  }

  public getMetadataService() {
    return this.metadataService;
  }

  public getQueryService() {
    return this.queryService;
  }
}
