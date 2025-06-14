// metadata-cache.service.ts
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { TokenMetadata } from './meta.types';

// Enhanced metadata with timestamp for cache management
export interface CachedTokenMetadata extends TokenMetadata {
  failed: boolean;
  cachedAt: number; // Unix timestamp when cached
  attempts: number; // Number of fetch attempts
  lastAttempt: number; // Last attempt timestamp
}

@Injectable()
export class MetadataCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetadataCacheService.name);
  private cache: Map<string, CachedTokenMetadata> = new Map();
  private pendingFetches: Set<string> = new Set(); // Track ongoing fetch operations
  private readonly CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour cache expiry
  private readonly RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes before retry failed fetches
  private cleanupInterval: NodeJS.Timeout;

  onModuleInit() {
    // Auto-cleanup every hour
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      60 * 60 * 1000,
    );

    this.logger.log('Metadata cache service initialized');
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.logger.log('Metadata cache service destroyed');
  }

  /**
   * Get metadata from cache, returns null if not found or expired
   */
  get(mintAddress: string): CachedTokenMetadata | null {
    const cached = this.cache.get(mintAddress);

    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    const now = Date.now();
    if (now - cached.cachedAt > this.CACHE_EXPIRY_MS) {
      this.cache.delete(mintAddress);
      return null;
    }

    return cached;
  }

  /**
   * Store metadata in cache
   */
  set(mintAddress: string, metadata: TokenMetadata): void {
    const cachedMetadata: CachedTokenMetadata = {
      ...metadata,
      cachedAt: Date.now(),
      attempts: 1,
      lastAttempt: Date.now(),
      failed: false,
    };

    this.cache.set(mintAddress, cachedMetadata);
    this.logger.debug(`Cached metadata for ${mintAddress} (${metadata.name})`);
  }

  /**
   * Mark a failed fetch attempt
   */
  markFailedAttempt(mintAddress: string): void {
    const existing = this.cache.get(mintAddress);
    const now = Date.now();

    if (existing) {
      existing.attempts++;
      existing.lastAttempt = now;
    } else {
      // Create a failed entry marker
      const failedEntry: any = {
        mint: mintAddress,
        name: '',
        symbol: '',
        uri: '',
        updateAuthority: '',
        isMutable: false,
        primarySaleHappened: false,
        sellerFeeBasisPoints: 0,
        cachedAt: now,
        attempts: 1,
        lastAttempt: now,
        failed: true, // Mark as failed
      };
      this.cache.set(mintAddress, failedEntry);
    }
  }

  /**
   * Check if we should retry fetching this mint
   */
  shouldRetry(mintAddress: string): boolean {
    const cached = this.cache.get(mintAddress);

    if (!cached) {
      return true; // First attempt
    }

    // If we have valid metadata, don't retry
    if (!cached.failed && cached.name) {
      return false;
    }

    // For failed entries, check if enough time has passed
    const now = Date.now();
    return now - cached.lastAttempt > this.RETRY_DELAY_MS;
  }

  /**
   * Check if fetch is currently in progress
   */
  isFetching(mintAddress: string): boolean {
    return this.pendingFetches.has(mintAddress);
  }

  /**
   * Mark fetch as in progress
   */
  markFetching(mintAddress: string): void {
    this.pendingFetches.add(mintAddress);
  }

  /**
   * Mark fetch as completed
   */
  markFetchCompleted(mintAddress: string): void {
    this.pendingFetches.delete(mintAddress);
  }

  /**
   * Get all cached metadata (for querying)
   */
  getAll(): Map<string, CachedTokenMetadata> {
    return new Map(this.cache);
  }

  /**
   * Search cached metadata by name or symbol
   */
  search(query: string): CachedTokenMetadata[] {
    const results: CachedTokenMetadata[] = [];
    const searchTerm = query.toLowerCase();

    for (const metadata of this.cache.values()) {
      if (metadata.failed) continue; // Skip failed entries

      if (
        metadata.name?.toLowerCase().includes(searchTerm) ||
        metadata.symbol?.toLowerCase().includes(searchTerm)
      ) {
        results.push(metadata);
      }
    }

    return results;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    successfulEntries: number;
    failedEntries: number;
    pendingFetches: number;
  } {
    let successful = 0;
    let failed = 0;

    for (const metadata of this.cache.values()) {
      if (metadata.failed) {
        failed++;
      } else {
        successful++;
      }
    }

    return {
      totalEntries: this.cache.size,
      successfulEntries: successful,
      failedEntries: failed,
      pendingFetches: this.pendingFetches.size,
    };
  }

  /**
   * Clean up expired and old failed entries
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [mintAddress, metadata] of this.cache.entries()) {
      const age = now - metadata.cachedAt;

      // Remove expired successful entries
      if (!metadata.failed && age > this.CACHE_EXPIRY_MS) {
        this.cache.delete(mintAddress);
        cleaned++;
      }
      // Remove old failed entries (after 24 hours)
      else if (metadata.failed && age > 24 * 60 * 60 * 1000) {
        this.cache.delete(mintAddress);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Export cache to JSON (for persistence)
   */
  export(): string {
    const cacheObject = Object.fromEntries(this.cache);
    return JSON.stringify(cacheObject, null, 2);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.pendingFetches.clear();
    this.logger.log(`Cleared ${size} cache entries`);
  }
}
