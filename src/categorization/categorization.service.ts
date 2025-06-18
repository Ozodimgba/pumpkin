import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import {
  TokenStreamDto,
  CategoryResultDto,
  TrendMetaDto,
  CategoryMetadata,
} from './categorization.dto';

interface OpenAICategorizationResponse {
  tokenName: string;
  category: string;
  confidence: number;
  reasoning: string;
}

@Injectable()
export class CategorizationService {
  private readonly logger = new Logger(CategorizationService.name);
  private readonly openai: OpenAI;
  private tokenBuffer: TokenStreamDto[] = [];
  private categories: Map<string, number> = new Map();
  private categoryMetadata: Map<string, CategoryMetadata> = new Map();
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_TIMEOUT = 30000; // 30 seconds

  constructor(private configService: ConfigService) {
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error(
        'OPENAI_API_KEY is required but not found in configuration',
      );
    }

    this.openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Initialize with base categories
    this.initializeCategories();

    // Setup batch processing timer
    setInterval(() => {
      this.processBatch().catch((error) =>
        this.logger.error('Batch processing error:', error),
      );
    }, this.BATCH_TIMEOUT);
  }

  private initializeCategories() {
    const baseCategoriesWithMetadata = [
      {
        name: 'Meme',
        description: 'Classic meme references and internet culture tokens',
        examples: ['PEPE', 'WOJAK', 'DOGE', 'CHAD', 'KAREN'],
        patterns: [
          'Popular meme names',
          'Internet slang',
          'Cultural references',
        ],
      },
      {
        name: 'Animals',
        description: 'Animal-themed tokens and creature references',
        examples: ['CAT', 'DOG', 'FROG', 'SHIBA', 'RABBIT'],
        patterns: ['Animal names', 'Pet references', 'Wildlife terms'],
      },
      {
        name: 'Food',
        description: 'Food, drinks, and culinary-themed tokens',
        examples: ['PIZZA', 'BURGER', 'TACO', 'BACON', 'SUSHI'],
        patterns: ['Food items', 'Restaurant names', 'Cooking terms'],
      },
      {
        name: 'Technology',
        description: 'Tech, AI, blockchain, and digital innovation tokens',
        examples: ['AI', 'ROBOT', 'CYBER', 'NANO', 'QUANTUM'],
        patterns: ['Tech buzzwords', 'AI terms', 'Blockchain concepts'],
      },
      {
        name: 'Space',
        description: 'Cosmic, astronomical, and space exploration themes',
        examples: ['MOON', 'MARS', 'SATURN', 'ROCKET', 'ALIEN'],
        patterns: ['Planets', 'Space objects', 'Sci-fi space terms'],
      },
      {
        name: 'Gaming',
        description: 'Video game references and gaming culture',
        examples: ['QUEST', 'BOSS', 'LEVEL', 'ARCADE', 'PIXEL'],
        patterns: ['Game terminology', 'Gaming platforms', 'Esports terms'],
      },
      {
        name: 'Finance',
        description: 'Traditional finance and investment terminology',
        examples: ['SAFE', 'MOON', 'BULL', 'BEAR', 'HODL'],
        patterns: ['Trading terms', 'Investment slang', 'Market concepts'],
      },
      {
        name: 'Sports',
        description: 'Sports teams, athletes, and athletic terminology',
        examples: ['GOAL', 'TEAM', 'WIN', 'CHAMPION', 'LEAGUE'],
        patterns: ['Sports terms', 'Team names', 'Athletic concepts'],
      },
      {
        name: 'Pop Culture',
        description:
          'Celebrity, entertainment, and mainstream culture references',
        examples: ['CELEB', 'STAR', 'FAME', 'SHOW', 'MOVIE'],
        patterns: [
          'Celebrity names',
          'Entertainment terms',
          'Pop culture refs',
        ],
      },
      {
        name: 'Random/Gibberish',
        description: 'Meaningless character combinations and random strings',
        examples: ['XJKDFH', 'ZQWERTY', 'MNBVCX', 'PLKJHG'],
        patterns: ['Random letters', 'Keyboard mashing', 'No clear meaning'],
      },
    ];

    baseCategoriesWithMetadata.forEach((cat) => {
      this.categories.set(cat.name, 0);
      this.categoryMetadata.set(cat.name, {
        description: cat.description,
        examples: cat.examples,
        patterns: cat.patterns,
        lastUpdated: new Date(),
      });
    });
  }

  async processTokenStream(token: TokenStreamDto): Promise<void> {
    this.tokenBuffer.push(token);

    // Process immediately if buffer is full
    if (this.tokenBuffer.length >= this.BATCH_SIZE) {
      await this.processBatch();
    }
  }

  private async processBatch(): Promise<CategoryResultDto[]> {
    if (this.tokenBuffer.length === 0) return [];

    const batch = this.tokenBuffer.splice(0, this.BATCH_SIZE);
    this.logger.log(`Processing batch of ${batch.length} tokens`);

    try {
      const results = await this.categorizeWithOpenAI(batch);
      this.logger.log(`Successfully categorized ${results.length} tokens`);

      // Log the results for debugging
      results.forEach((result) => {
        this.logger.log(
          `Token: ${result.tokenName} → Category: ${result.category} (confidence: ${result.confidence})`,
        );
      });

      // Update category counts
      results.forEach((result) => {
        const current = this.categories.get(result.category) || 0;
        this.categories.set(result.category, current + 1);
      });

      this.logger.log(
        `Updated category counts: ${JSON.stringify(Object.fromEntries(this.categories))}`,
      );
      return results;
    } catch (error) {
      this.logger.error('Failed to process batch:', error);
      // Re-add tokens to buffer for retry
      this.tokenBuffer.unshift(...batch);
      return [];
    }
  }

  private async categorizeWithOpenAI(
    tokens: TokenStreamDto[],
  ): Promise<CategoryResultDto[]> {
    const categoriesList = Array.from(this.categories.keys());

    const prompt = `
You are a crypto token categorizer. Categorize these pump.fun tokens into the most appropriate category.

Available Categories: ${categoriesList.join(', ')}

Tokens to categorize:
${tokens.map((t, i) => `${i + 1}. Name: "${t.name}" ${t.description ? `Description: "${t.description}"` : ''}`).join('\n')}

IMPORTANT INSTRUCTIONS:
- If a token fits an existing category well (confidence >= 0.7), use that category
- If a token doesn't fit well (confidence < 0.7), create a NEW category that better describes it
- For new categories, use the format: "NEW_CATEGORY: CategoryName" in the category field
- Be creative with new categories: "Sci-Fi", "Numbers", "Symbols", "Brands", "Countries", "Colors", etc.
- Don't overuse Random/Gibberish - only for truly meaningless strings

Return a JSON array with this format for each token:
{
  "tokenName": "exact token name",
  "category": "category name OR NEW_CATEGORY: CategoryName",
  "confidence": 0.95,
  "reasoning": "brief explanation"
}

Examples:
- "DOGECOIN" → "Animals" (confidence: 0.9)
- "BITCOIN2024" → "NEW_CATEGORY: Numbers" (confidence: 0.8)
- "REDTOKEN" → "NEW_CATEGORY: Colors" (confidence: 0.8)
- "XCVBNM" → "Random/Gibberish" (confidence: 0.9)
`;

    this.logger.log('Sending request to OpenAI...');

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    this.logger.log(
      `OpenAI response received. Content length: ${content?.length || 0}`,
    );

    if (!content) throw new Error('No response from OpenAI');

    try {
      const parsed = JSON.parse(content) as OpenAICategorizationResponse[];

      // Validate the response structure
      if (!Array.isArray(parsed)) {
        throw new Error('Expected array response from OpenAI');
      }

      // Process results and handle new categories
      const processedResults: CategoryResultDto[] = [];

      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;

        let finalCategory = item.category;

        // Check if this is a new category suggestion
        if (item.category.startsWith('NEW_CATEGORY:')) {
          const newCategoryName = item.category
            .replace('NEW_CATEGORY:', '')
            .trim();

          // Add the new category if it doesn't exist
          if (!this.categories.has(newCategoryName)) {
            this.addCategory(
              newCategoryName,
              `Dynamically created category for ${newCategoryName}-themed tokens`,
            );
            this.logger.log(
              `🆕 Created new category: "${newCategoryName}" for token: ${item.tokenName}`,
            );
          }

          finalCategory = newCategoryName;
        }

        // Validate the category exists now
        if (!this.categories.has(finalCategory)) {
          this.logger.warn(
            `Category "${finalCategory}" doesn't exist, defaulting to Random/Gibberish for ${item.tokenName}`,
          );
          finalCategory = 'Random/Gibberish';
        }

        processedResults.push({
          tokenName: item.tokenName,
          category: finalCategory,
          confidence: item.confidence || 0.5,
          reasoning: item.reasoning || 'No reasoning provided',
          timestamp: new Date(),
        });
      }

      this.logger.log(
        `Successfully processed ${processedResults.length} categorization results`,
      );
      return processedResults;
    } catch (error) {
      this.logger.error('Failed to parse OpenAI response:', content);
      throw error;
    }
  }

  addCategory(categoryName: string, description?: string): void {
    if (!this.categories.has(categoryName)) {
      this.categories.set(categoryName, 0);
      this.categoryMetadata.set(categoryName, {
        description:
          description || `Dynamic category for ${categoryName}-themed tokens`,
        examples: [],
        patterns: this.generatePatternsForCategory(categoryName),
        lastUpdated: new Date(),
      });
      this.logger.log(`Added new category: ${categoryName}`);
    }
  }

  private generatePatternsForCategory(categoryName: string): string[] {
    const patternMap: Record<string, string[]> = {
      KeyboardMash: [
        'Random key combinations',
        'QWERTY sequences',
        'Keyboard pattern typing',
      ],
      Alphanumeric: [
        'Letters + numbers',
        'Mixed character patterns',
        'Coded sequences',
      ],
      Abbreviations: [
        'Short letter combos',
        '3-5 character codes',
        'Acronym-style names',
      ],
      Hype: ['Excitement terms', 'Pump language', 'Enthusiasm expressions'],
      Community: [
        'Group-focused terms',
        'Collective language',
        'Together themes',
      ],
      'Sci-Fi': [
        'Futuristic themes',
        'Science fiction refs',
        'Tech fantasy terms',
      ],
    };

    return (
      patternMap[categoryName] || [
        'Tokens related to ' + categoryName,
        'Thematic variations',
        'Pattern-based naming',
      ]
    );
  }

  getTop10MetaTrends(): TrendMetaDto[] {
    const total = Array.from(this.categories.values()).reduce(
      (sum, count) => sum + count,
      0,
    );

    return Array.from(this.categories.entries())
      .map(([category, count]) => {
        const metadata = this.categoryMetadata.get(category);
        return {
          category,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
          growth: 0, // TODO: Calculate from historical data
          description:
            metadata?.description ||
            `Dynamic category for ${category}-themed tokens`,
          examples: metadata?.examples || [],
          patterns: metadata?.patterns || [],
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // Update category examples with real token names
  private updateCategoryExamples(category: string, tokenName: string): void {
    const metadata = this.categoryMetadata.get(category);
    if (metadata) {
      // Add to examples if not already present and limit to 10 most recent
      if (!metadata.examples.includes(tokenName)) {
        metadata.examples.unshift(tokenName);
        metadata.examples = metadata.examples.slice(0, 10); // Keep only 10 most recent
        metadata.lastUpdated = new Date();
      }
    }
  }

  // Reset all category counts (useful for testing)
  resetCategoryCounts(): void {
    for (const [category] of this.categories) {
      this.categories.set(category, 0);
    }
    this.logger.log('Reset all category counts to 0');
  }

  // Remove categories with zero counts (cleanup)
  cleanupEmptyCategories(): void {
    const emptyCategories: string[] = [];
    for (const [category, count] of this.categories) {
      if (count === 0 && !this.isBaseCategory(category)) {
        emptyCategories.push(category);
      }
    }

    emptyCategories.forEach((category) => {
      this.categories.delete(category);
      this.logger.log(`Removed empty category: ${category}`);
    });
  }

  private isBaseCategory(category: string): boolean {
    const baseCategories = [
      'Meme',
      'Animals',
      'Food',
      'Technology',
      'Space',
      'Gaming',
      'Finance',
      'Sports',
      'Pop Culture',
      'Random/Gibberish',
    ];
    return baseCategories.includes(category);
  }

  // Get all current categories
  getAllCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  // Get metadata for a specific category
  getCategoryMetadata(categoryName: string) {
    const count = this.categories.get(categoryName) || 0;
    const metadata = this.categoryMetadata.get(categoryName);

    if (!metadata) {
      return { error: `Category "${categoryName}" not found` };
    }

    return {
      category: categoryName,
      count,
      description: metadata.description,
      examples: metadata.examples,
      patterns: metadata.patterns,
      lastUpdated: metadata.lastUpdated,
    };
  }

  // Get token generation suggestions based on trending categories
  getTokenGenerationSuggestions(topN: number = 5) {
    const trends = this.getTop10MetaTrends().slice(0, topN);

    return {
      message: `Top ${topN} trending categories for token generation`,
      suggestions: trends.map((trend) => ({
        category: trend.category,
        trendStrength: trend.percentage.toFixed(1) + '%',
        description: trend.description,
        recentExamples: trend.examples?.slice(0, 5),
        suggestedPatterns: trend.patterns,
        generationTips: this.getGenerationTips(trend.category),
      })),
    };
  }

  private getGenerationTips(category: string): string[] {
    const tipMap: Record<string, string[]> = {
      Meme: [
        'Use popular internet slang',
        'Reference viral memes',
        'Add numbers like 420, 69',
      ],
      Animals: [
        'Combine with SAFE, MOON, INU suffixes',
        'Use cute animal names',
        'Mix with crypto terms',
      ],
      Food: [
        'Combine food names with crypto suffixes',
        'Use restaurant/brand names',
        'Add COIN, TOKEN endings',
      ],
      Space: [
        'Use planet/star names',
        'Add ROCKET, MOON themes',
        'Reference sci-fi concepts',
      ],
      Technology: [
        'Use AI, NANO, CYBER prefixes',
        'Reference blockchain terms',
        'Add futuristic suffixes',
      ],
      'Sci-Fi': [
        'Use futuristic themes',
        'Reference popular sci-fi media',
        'Combine with numbers',
      ],
      Community: [
        'Use SAFE, TOGETHER themes',
        'Reference collective terms',
        'Add community buzzwords',
      ],
      Abbreviations: [
        'Create short 3-5 letter combos',
        'Use common crypto abbreviations',
        'Mix familiar letters',
      ],
      Alphanumeric: [
        'Combine letters with numbers',
        'Use repeating patterns',
        'Add crypto-relevant numbers',
      ],
      'Keyboard Patterns': [
        'Use QWERTY sequences',
        'Create typing patterns',
        'Mix familiar key combinations',
      ],
    };

    return (
      tipMap[category] || [
        'Study recent examples in this category',
        'Follow the established patterns',
        'Add crypto-themed suffixes',
      ]
    );
  }

  getCategoryStats() {
    return {
      totalTokens: Array.from(this.categories.values()).reduce(
        (sum, count) => sum + count,
        0,
      ),
      categories: Object.fromEntries(this.categories),
      bufferSize: this.tokenBuffer.length,
    };
  }
}
