export interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
  mint: string;
  updateAuthority: string;
  isMutable: boolean;
  primarySaleHappened: boolean;
  sellerFeeBasisPoints: number;
  offChainMetadata?: {
    name?: string;
    symbol?: string;
    description?: string;
    image?: string;
    showName?: boolean;
    createdOn?: string;
    twitter?: string;
    website?: string;
    telegram?: string;
  };
  cachedAt?: number;
  attempts?: number;
  lastAttempt?: number;
  failed?: boolean;
  category?: string;
  timestamp?: number;
}
