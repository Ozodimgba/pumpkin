// metadata-query.service.ts
import { Injectable } from '@nestjs/common';
import { MetadataCacheService, CachedTokenMetadata } from './meta.service';

@Injectable()
export class MetadataQueryService {
  constructor(private metadataCache: MetadataCacheService) {}

  /**
   * Get metadata by mint address
   */
  getByMint(mintAddress: string): CachedTokenMetadata | null {
    return this.metadataCache.get(mintAddress);
  }

  /**
   * Search by name or symbol (case insensitive)
   */
  search(query: string): CachedTokenMetadata[] {
    return this.metadataCache.search(query);
  }

  /**
   * Get all tokens with a specific symbol
   */
  getBySymbol(symbol: string): CachedTokenMetadata[] {
    const results: CachedTokenMetadata[] = [];

    for (const metadata of this.metadataCache.getAll().values()) {
      if (metadata.failed) continue;

      if (metadata.symbol?.toLowerCase() === symbol.toLowerCase()) {
        results.push(metadata);
      }
    }

    return results;
  }

  /**
   * Get all tokens with names containing a keyword
   */
  getByNameKeyword(keyword: string): CachedTokenMetadata[] {
    const results: CachedTokenMetadata[] = [];
    const searchTerm = keyword.toLowerCase();

    for (const metadata of this.metadataCache.getAll().values()) {
      if (metadata.failed) continue;

      if (metadata.name?.toLowerCase().includes(searchTerm)) {
        results.push(metadata);
      }
    }

    return results;
  }

  /**
   * Get recently cached tokens (within last N minutes)
   */
  getRecent(minutesAgo: number = 60): CachedTokenMetadata[] {
    const cutoffTime = Date.now() - minutesAgo * 60 * 1000;
    const results: CachedTokenMetadata[] = [];

    for (const metadata of this.metadataCache.getAll().values()) {
      if (metadata.failed) continue;

      if (metadata.cachedAt >= cutoffTime) {
        results.push(metadata);
      }
    }

    // Sort by most recent first
    return results.sort((a, b) => b.cachedAt - a.cachedAt);
  }

  /**
   * Get tokens with specific characteristics
   */
  getByCharacteristics(filters: {
    isMutable?: boolean;
    primarySaleHappened?: boolean;
    hasImage?: boolean;
    hasDescription?: boolean;
    sellerFeeBasisPointsMin?: number;
    sellerFeeBasisPointsMax?: number;
  }): CachedTokenMetadata[] {
    const results: CachedTokenMetadata[] = [];

    for (const metadata of this.metadataCache.getAll().values()) {
      if (metadata.failed) continue;

      let matches = true;

      if (
        filters.isMutable !== undefined &&
        metadata.isMutable !== filters.isMutable
      ) {
        matches = false;
      }

      if (
        filters.primarySaleHappened !== undefined &&
        metadata.primarySaleHappened !== filters.primarySaleHappened
      ) {
        matches = false;
      }

      if (filters.hasImage !== undefined) {
        const hasImage = !!metadata.offChainMetadata?.image;
        if (hasImage !== filters.hasImage) {
          matches = false;
        }
      }

      if (filters.hasDescription !== undefined) {
        const hasDescription = !!metadata.offChainMetadata?.description;
        if (hasDescription !== filters.hasDescription) {
          matches = false;
        }
      }

      if (
        filters.sellerFeeBasisPointsMin !== undefined &&
        metadata.sellerFeeBasisPoints < filters.sellerFeeBasisPointsMin
      ) {
        matches = false;
      }

      if (
        filters.sellerFeeBasisPointsMax !== undefined &&
        metadata.sellerFeeBasisPoints > filters.sellerFeeBasisPointsMax
      ) {
        matches = false;
      }

      if (matches) {
        results.push(metadata);
      }
    }

    return results;
  }

  /**
   * Get all successful entries (excluding failed fetches)
   */
  getAllSuccessful(): CachedTokenMetadata[] {
    const results: CachedTokenMetadata[] = [];

    for (const metadata of this.metadataCache.getAll().values()) {
      if (!metadata.failed) {
        results.push(metadata);
      }
    }

    return results;
  }

  /**
   * Export filtered results to JSON
   */
  exportFiltered(filterFn: (metadata: CachedTokenMetadata) => boolean): string {
    const filtered = Array.from(this.metadataCache.getAll().values()).filter(
      filterFn,
    );
    return JSON.stringify(filtered, null, 2);
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalTokens: number;
    uniqueSymbols: number;
    tokensWithImages: number;
    tokensWithDescriptions: number;
    averageSellerFee: number;
    mutableTokens: number;
    primarySalesCompleted: number;
  } {
    const successful = this.getAllSuccessful();
    const symbols = new Set<string>();
    let tokensWithImages = 0;
    let tokensWithDescriptions = 0;
    let totalSellerFees = 0;
    let mutableTokens = 0;
    let primarySalesCompleted = 0;

    for (const metadata of successful) {
      if (metadata.symbol) symbols.add(metadata.symbol);
      if (metadata.offChainMetadata?.image) tokensWithImages++;
      if (metadata.offChainMetadata?.description) tokensWithDescriptions++;
      totalSellerFees += metadata.sellerFeeBasisPoints;
      if (metadata.isMutable) mutableTokens++;
      if (metadata.primarySaleHappened) primarySalesCompleted++;
    }

    return {
      totalTokens: successful.length,
      uniqueSymbols: symbols.size,
      tokensWithImages,
      tokensWithDescriptions,
      averageSellerFee:
        successful.length > 0 ? totalSellerFees / successful.length : 0,
      mutableTokens,
      primarySalesCompleted,
    };
  }

  // CLI-style query functions for easy use
  getQueryInterface() {
    return {
      // Get by mint address
      mint: (address: string) => this.getByMint(address),

      // Search by name or symbol
      search: (term: string) => this.search(term),

      // Get by symbol
      symbol: (symbol: string) => this.getBySymbol(symbol),

      // Get recent tokens
      recent: (minutes: number = 60) => this.getRecent(minutes),

      // Get all successful
      all: () => this.getAllSuccessful(),

      // Get summary
      summary: () => this.getSummary(),

      // Get cache stats
      stats: () => this.metadataCache.getStats(),

      // Clear cache
      clear: () => this.metadataCache.clear(),

      // Export cache
      export: () => this.metadataCache.export(),

      // Custom filter
      filter: (filterFn: (metadata: CachedTokenMetadata) => boolean) =>
        this.getAllSuccessful().filter(filterFn),
    };
  }
}
