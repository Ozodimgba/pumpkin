export class TokenStreamDto {
  name: string;
  description?: string;
  timestamp: Date;
  mint?: string;
}

export class CategoryResultDto {
  tokenName: string;
  category: string;
  confidence: number;
  reasoning?: string;
  timestamp: Date;
}

export interface TrendMetaDto {
  category: string;
  count: number;
  percentage: number;
  growth: number;
  description?: string;
  examples?: string[];
  patterns?: string[];
}

export interface CategoryMetadata {
  description: string;
  examples: string[];
  patterns: string[];
  lastUpdated: Date;
}
