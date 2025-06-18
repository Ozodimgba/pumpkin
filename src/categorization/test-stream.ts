import { Injectable, Logger } from '@nestjs/common';
import { CategorizationService } from './categorization.service';
import { TokenStreamDto } from './categorization.dto';

@Injectable()
export class TestStreamService {
  private readonly logger = new Logger(TestStreamService.name);
  private streamInterval: NodeJS.Timeout | null = null;
  private isStreaming = false;

  constructor(private categorizationService: CategorizationService) {}

  // Realistic pump.fun token names and patterns
  private tokenPatterns = {
    memes: [
      'PEPE',
      'WOJAK',
      'DOGE',
      'SHIBA',
      'CHAD',
      'KAREN',
      'BOOMER',
      'ZOOMER',
      'PEPECOIN',
      'DOGEKING',
      'SHIBAMOON',
      'CHADTOKEN',
      'WOJAKSAFE',
    ],
    animals: [
      'CAT',
      'DOG',
      'FROG',
      'HAMSTER',
      'RABBIT',
      'TIGER',
      'LION',
      'BEAR',
      'CATCOIN',
      'DOGMOON',
      'FROGSAFE',
      'HAMSTERINU',
      'RABBITKING',
    ],
    food: [
      'PIZZA',
      'BURGER',
      'TACO',
      'SUSHI',
      'BACON',
      'CHEESE',
      'BREAD',
      'PIZZATOKEN',
      'BURGERCOIN',
      'TACOMOON',
      'SUSHIBEAR',
      'BACONSAFE',
    ],
    space: [
      'MOON',
      'MARS',
      'SATURN',
      'ROCKET',
      'ALIEN',
      'UFO',
      'SPACE',
      'MOONSHOT',
      'MARSINU',
      'ROCKETMOON',
      'ALIENCOIN',
      'UFOTOKEN',
    ],
    tech: [
      'AI',
      'ROBOT',
      'CYBER',
      'NANO',
      'QUANTUM',
      'BLOCKCHAIN',
      'METAVERSE',
      'AICOIN',
      'ROBOTINU',
      'CYBERMOON',
      'NANOTOKEN',
      'QUANTUMSAFE',
    ],
    gibberish: [
      'XJKDFH',
      'ZQWERTY',
      'MNBVCX',
      'PLKJHG',
      'ASDFGH',
      'QAZWSX',
      'EDCRFV',
      'TGBYHN',
      'UJMIKL',
      'OPQRST',
      'UVWXYZ',
      'ABCDEF',
    ],
    random: [
      'SAFEMOON',
      'BABYDOGE',
      'ELONMARS',
      'MOONPEPE',
      'DOGELON',
      'SHIBAINU',
      'FLOKIINU',
      'KISHU',
      'HOGE',
      'BONK',
      'WIF',
      'MYRO',
    ],
  };

  private descriptions = [
    'The next 1000x gem! 🚀',
    'Community driven meme coin',
    'To the moon and beyond! 🌙',
    'Fair launch, no presale',
    'Diamond hands only 💎',
    'HODL for life',
    'Ape in now or cry later',
    'This is not financial advice',
    'LFG!!! 🔥🔥🔥',
    'Best community in crypto',
    'Revolutionary tokenomics',
    'Deflationary supply',
    undefined, // Some tokens have no description
    undefined,
    undefined,
  ];

  private suffixes = [
    'INU',
    'COIN',
    'TOKEN',
    'SAFE',
    'MOON',
    'MARS',
    'X',
    '69',
    '420',
    'AI',
  ];
  private prefixes = [
    'BABY',
    'MINI',
    'MEGA',
    'SUPER',
    'ULTRA',
    'HYPER',
    'SAFE',
    'TRUE',
  ];

  private generateRandomToken(): TokenStreamDto {
    const patterns = Object.values(this.tokenPatterns).flat();
    const categories = Object.keys(this.tokenPatterns);

    let tokenName: string;
    let description: string | undefined;

    // 70% chance of using a pattern-based name, 30% pure gibberish
    if (Math.random() < 0.7) {
      const category =
        categories[Math.floor(Math.random() * categories.length)];
      const baseTokens =
        this.tokenPatterns[category as keyof typeof this.tokenPatterns];
      let baseToken = baseTokens[Math.floor(Math.random() * baseTokens.length)];

      // Sometimes add prefix/suffix (40% chance)
      if (Math.random() < 0.4) {
        if (Math.random() < 0.5) {
          const prefix =
            this.prefixes[Math.floor(Math.random() * this.prefixes.length)];
          baseToken = prefix + baseToken;
        } else {
          const suffix =
            this.suffixes[Math.floor(Math.random() * this.suffixes.length)];
          baseToken = baseToken + suffix;
        }
      }

      // Sometimes add random numbers (30% chance)
      if (Math.random() < 0.3) {
        const number = Math.floor(Math.random() * 9999);
        baseToken = baseToken + number;
      }

      // Sometimes make it misspelled (20% chance)
      if (Math.random() < 0.2) {
        baseToken = this.introduceTypos(baseToken);
      }

      tokenName = baseToken;
    } else {
      // Pure gibberish
      tokenName = this.generateGibberish();
    }

    // Random description (60% have description)
    description =
      Math.random() < 0.6
        ? this.descriptions[
            Math.floor(Math.random() * this.descriptions.length)
          ]
        : undefined;

    return {
      name: tokenName,
      description,
      timestamp: new Date(),
      mint: this.generateFakeMint(),
    };
  }

  private introduceTypos(word: string): string {
    const chars = word.split('');
    const numTypos = Math.floor(Math.random() * 2) + 1; // 1-2 typos

    for (let i = 0; i < numTypos; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      // Replace with random letter
      chars[randomIndex] = String.fromCharCode(
        65 + Math.floor(Math.random() * 26),
      );
    }

    return chars.join('');
  }

  private generateGibberish(): string {
    const length = Math.floor(Math.random() * 8) + 4; // 4-12 characters
    let result = '';

    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(65 + Math.floor(Math.random() * 26));
    }

    return result;
  }

  private generateFakeMint(): string {
    // Generate fake Solana mint address
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';
    let result = '';
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  startFakeStream(intervalMs: number = 2000): void {
    if (this.isStreaming) {
      this.logger.warn('Fake stream is already running');
      return;
    }

    this.logger.log(`Starting fake token stream with ${intervalMs}ms interval`);
    this.isStreaming = true;

    this.streamInterval = setInterval(() => {
      const token = this.generateRandomToken();
      this.logger.log(
        `Generated token: ${token.name} - ${token.description || 'No description'}`,
      );

      // Send to categorization service
      this.categorizationService.processTokenStream(token).catch((error) => {
        this.logger.error('Failed to process token:', error);
      });
    }, intervalMs);
  }

  stopFakeStream(): void {
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
      this.isStreaming = false;
      this.logger.log('Fake token stream stopped');
    }
  }

  getStreamStatus() {
    return {
      isStreaming: this.isStreaming,
      interval: this.streamInterval ? 'active' : 'inactive',
    };
  }

  // Generate a burst of tokens for immediate testing
  async generateBurst(count: number = 10): Promise<void> {
    this.logger.log(`Generating burst of ${count} tokens`);

    for (let i = 0; i < count; i++) {
      const token = this.generateRandomToken();
      await this.categorizationService.processTokenStream(token);
      this.logger.log(`Burst token ${i + 1}: ${token.name}`);
    }
  }
}
