import { GoogleGenAI } from '@google/genai';
import { PROMPTS } from '../config/prompts';

export interface TitleGenerationResult {
  title: string;
}

export interface TitleGenerationError {
  type: 'network' | 'auth' | 'quota' | 'server' | 'timeout' | 'empty';
  message: string;
  retryable: boolean;
}

export interface TitleGenerationOptions {
  timeout?: number;
  retryAttempts?: number;
}

const DEFAULT_OPTIONS: Required<TitleGenerationOptions> = {
  timeout: 30000, // 30 seconds (title generation is faster than transcription)
  retryAttempts: 3,
};

class TitleGenerationService {
  private genAI: GoogleGenAI | null = null;
  private apiKey: string | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      const apiKey = this.getApiKey();
      if (apiKey) {
        this.genAI = new GoogleGenAI({ apiKey });
        this.apiKey = apiKey;
      } else {
        console.warn('Gemini API key not found in environment variables');
      }
    } catch (error) {
      console.warn('Failed to initialize Gemini API:', error);
    }
  }

  private getApiKey(): string | null {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      console.error('EXPO_PUBLIC_GEMINI_API_KEY not found in .env file');
      return null;
    }

    if (apiKey.trim().length === 0) {
      console.error('EXPO_PUBLIC_GEMINI_API_KEY is empty in .env file');
      return null;
    }

    return apiKey.trim();
  }

  private createTitleGenerationError(error: any, context: string): TitleGenerationError {
    if (error?.message?.includes('API key') || error?.message?.includes('authentication')) {
      return {
        type: 'auth',
        message: 'Invalid or missing API key. Please check your Gemini API configuration in .env file.',
        retryable: false,
      };
    }

    if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
      return {
        type: 'quota',
        message: 'API quota exceeded or rate limit reached. Please try again later.',
        retryable: true,
      };
    }

    if (error?.message?.includes('timeout') || error?.code === 'NETWORK_TIMEOUT') {
      return {
        type: 'timeout',
        message: 'Request timeout. Title generation took too long to process.',
        retryable: true,
      };
    }

    if (error?.message?.includes('network') || error?.code === 'NETWORK_ERROR') {
      return {
        type: 'network',
        message: 'Network error. Please check your internet connection.',
        retryable: true,
      };
    }

    return {
      type: 'server',
      message: `Title generation failed: ${error?.message || 'Unknown error'} (${context})`,
      retryable: true,
    };
  }

  private extractFirstWords(transcription: string, maxWords: number = 6): string {
    // Clean up the transcription
    const words = transcription
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 0);

    // Take first maxWords words and capitalize
    const titleWords = words.slice(0, maxWords);

    // Convert to title case
    return titleWords
      .map((word, index) => {
        // Capitalize first word and words longer than 3 characters
        if (index === 0 || word.length > 3) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        return word.toLowerCase();
      })
      .join(' ');
  }

  async generateTitle(
    transcription: string,
    options: TitleGenerationOptions = {}
  ): Promise<TitleGenerationResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Validate transcription
    if (!transcription || transcription.trim().length === 0) {
      throw {
        type: 'empty',
        message: 'Cannot generate title from empty transcription.',
        retryable: false,
      } as TitleGenerationError;
    }

    if (!this.genAI || !this.apiKey) {
      // Fallback to first words if API not available
      console.warn('Gemini API not initialized, using fallback title generation');
      return {
        title: this.extractFirstWords(transcription),
      };
    }

    let lastError: any = null;

    // Retry logic
    for (let attempt = 1; attempt <= opts.retryAttempts; attempt++) {
      try {
        const prompt = `${PROMPTS.TITLE_GENERATION}\n\nTranscription:\n${transcription}`;

        const result = await Promise.race([
          this.genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), opts.timeout)
          ),
        ]) as any;

        const title = result.text?.trim();

        if (!title || title.length === 0) {
          throw new Error('Empty title received from API');
        }

        // Validate title length (should be 3-6 words, but we'll be lenient)
        const wordCount = title.split(/\s+/).length;
        if (wordCount > 10) {
          console.warn('Generated title is longer than expected, using fallback');
          return {
            title: this.extractFirstWords(transcription),
          };
        }

        return {
          title: title,
        };

      } catch (error) {
        lastError = error;
        console.warn(`Title generation attempt ${attempt} failed:`, error);

        const titleError = this.createTitleGenerationError(error, `attempt ${attempt}`);

        // Don't retry for non-retryable errors
        if (!titleError.retryable) {
          // Use fallback for non-retryable errors
          console.warn('Non-retryable error, using fallback title generation');
          return {
            title: this.extractFirstWords(transcription),
          };
        }

        // Wait before retry (exponential backoff)
        if (attempt < opts.retryAttempts) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed, use fallback
    console.warn('All title generation attempts failed, using fallback');
    return {
      title: this.extractFirstWords(transcription),
    };
  }

  async isServiceAvailable(): Promise<boolean> {
    return this.genAI !== null && this.apiKey !== null;
  }
}

// Export singleton instance
export const titleGenerationService = new TitleGenerationService();
export default titleGenerationService;
