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

// Yellowstone gRPC Types
export interface CompiledInstruction {
  programIdIndex: number;
  accounts: Uint8Array;
  data: Uint8Array;
}

export interface MessageHeader {
  numRequiredSignatures: number;
  numReadonlySignedAccounts: number;
  numReadonlyUnsignedAccounts: number;
}

export interface MessageAddressTableLookup {
  accountKey: Uint8Array;
  writableIndexes: Uint8Array;
  readonlyIndexes: Uint8Array;
}

export interface Message {
  header: MessageHeader | undefined;
  accountKeys: Uint8Array[];
  recentBlockhash: Uint8Array;
  instructions: CompiledInstruction[];
  versioned: boolean;
  addressTableLookups: MessageAddressTableLookup[];
}

export interface FormattedTransactionData {
  signature: string;
  slot: string;
  [accountName: string]: string;
}

export interface TrendData {
  category: string;
  tokenCount: number;
  velocity: number;
  momentum?: number;
  acceleration?: number;
  trend: 'VIRAL' | 'STEADY' | 'DECLINING' | 'EMERGING';
  lastUpdated: number;
}
