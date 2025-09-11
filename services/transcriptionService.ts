import { GoogleGenAI } from '@google/genai';
import * as FileSystem from 'expo-file-system';

export interface TranscriptionResult {
  transcription: string;
  confidence?: number;
  language?: string;
  duration?: number;
}

export interface TranscriptionError {
  type: 'network' | 'auth' | 'format' | 'size' | 'quota' | 'server' | 'file' | 'timeout';
  message: string;
  retryable: boolean;
}

export interface TranscriptionOptions {
  language?: string;
  timeout?: number;
  retryAttempts?: number;
  includeTimestamps?: boolean;
}

const DEFAULT_OPTIONS: Required<TranscriptionOptions> = {
  language: 'auto',
  timeout: 120000, // 2 minutes
  retryAttempts: 3,
  includeTimestamps: false,
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit for inline audio
const SUPPORTED_FORMATS = ['.m4a', '.mp4', '.wav', '.mp3', '.flac', '.ogg'];

class TranscriptionService {
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
        console.log('✅ Gemini API initialized successfully');
      } else {
        console.warn('⚠️ Gemini API key not found in environment variables');
      }
    } catch (error) {
      console.warn('Failed to initialize Gemini API:', error);
    }
  }

  private getApiKey(): string | null {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ EXPO_PUBLIC_GEMINI_API_KEY not found in .env file');
      console.log('💡 Please add EXPO_PUBLIC_GEMINI_API_KEY=your_api_key_here to your .env file');
      return null;
    }

    if (apiKey.trim().length === 0) {
      console.error('❌ EXPO_PUBLIC_GEMINI_API_KEY is empty in .env file');
      return null;
    }

    return apiKey.trim();
  }

  private validateFile(filePath: string, fileSize: number): TranscriptionError | null {
    // Check file extension
    const fileExtension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    if (!SUPPORTED_FORMATS.includes(fileExtension)) {
      return {
        type: 'format',
        message: `Unsupported audio format: ${fileExtension}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`,
        retryable: false,
      };
    }

    // Check file size
    if (fileSize > MAX_FILE_SIZE) {
      return {
        type: 'size',
        message: `File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        retryable: false,
      };
    }

    return null;
  }

  private async convertAudioToBase64(filePath: string): Promise<string> {
    try {
      const base64 = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch (error) {
      throw new Error(`Failed to read audio file: ${error}`);
    }
  }

  private getMimeType(filePath: string): string {
    const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    const mimeTypeMap: Record<string, string> = {
      '.m4a': 'audio/mp4',
      '.mp4': 'audio/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
    };
    return mimeTypeMap[extension] || 'audio/mp4';
  }

  private createTranscriptionError(error: any, context: string): TranscriptionError {
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
        message: 'Request timeout. The transcription took too long to process.',
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
      message: `Transcription failed: ${error?.message || 'Unknown error'} (${context})`,
      retryable: true,
    };
  }

  async transcribeAudio(
    filePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (!this.genAI || !this.apiKey) {
      throw {
        type: 'auth',
        message: 'Gemini API not initialized. Please configure EXPO_PUBLIC_GEMINI_API_KEY in your .env file.',
        retryable: false,
      } as TranscriptionError;
    }

    // Validate file exists
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      throw {
        type: 'file',
        message: 'Audio file not found. Please ensure the recording was saved successfully.',
        retryable: false,
      } as TranscriptionError;
    }

    // Validate file format and size
    const validationError = this.validateFile(filePath, fileInfo.size!);
    if (validationError) {
      throw validationError;
    }

    let lastError: any = null;

    // Retry logic
    for (let attempt = 1; attempt <= opts.retryAttempts; attempt++) {
      try {
        console.log(`🎙️ Transcription attempt ${attempt}/${opts.retryAttempts} for file: ${filePath.split('/').pop()}`);

        // Convert audio to base64
        const base64Audio = await this.convertAudioToBase64(filePath);
        const mimeType = this.getMimeType(filePath);

        // Use Gemini 2.0 Flash for transcription
        const prompt = opts.includeTimestamps 
          ? 'Please transcribe this audio file and include timestamps where possible. Provide a clear, accurate transcription of all spoken content.'
          : 'Please transcribe this audio file accurately. Provide a clear transcription of all spoken content.';

        const result = await Promise.race([
          this.genAI.models.generateContent({
            model: 'gemini-2.0-flash-001',
            contents: [
              {
                parts: [
                  {
                    text: prompt
                  },
                  {
                    inlineData: {
                      data: base64Audio,
                      mimeType,
                    },
                  }
                ]
              }
            ]
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), opts.timeout)
          ),
        ]) as any;

        const transcription = result.text;

        if (!transcription || transcription.trim().length === 0) {
          throw new Error('Empty transcription received from API');
        }

        console.log('✅ Transcription successful:', transcription.substring(0, 100) + '...');

        return {
          transcription: transcription.trim(),
          duration: fileInfo.modificationTime ? Date.now() - fileInfo.modificationTime : undefined,
        };

      } catch (error) {
        lastError = error;
        console.warn(`❌ Transcription attempt ${attempt} failed:`, error);

        const transcriptionError = this.createTranscriptionError(error, `attempt ${attempt}`);
        
        // Don't retry for non-retryable errors
        if (!transcriptionError.retryable) {
          throw transcriptionError;
        }

        // Wait before retry (exponential backoff)
        if (attempt < opts.retryAttempts) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw this.createTranscriptionError(lastError, 'all retries exhausted');
  }

  async isServiceAvailable(): Promise<boolean> {
    return this.genAI !== null && this.apiKey !== null;
  }

  async testConnection(): Promise<boolean> {
    if (!this.genAI) return false;

    try {
      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash-001',
        contents: 'Hello, this is a test.'
      });
      return !!result.text;
    } catch (error) {
      console.warn('Gemini API connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const transcriptionService = new TranscriptionService();
export default transcriptionService;