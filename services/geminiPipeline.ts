import { GoogleGenAI } from '@google/genai';
import { PROMPTS } from '../config/prompts';
import { parseJsonResponse } from './parseJson';
import type { PipelineProvider, ValidationResult, Angle, AngleResult } from './aiProvider';

// Re-export domain types for backwards compatibility
export type { ValidationResult, Angle, AngleResult } from './aiProvider';

// ── Prompt accessors (kept for claudeProvider import compatibility) ─────────

export const VALIDATION_PROMPT = (transcript: string) =>
  PROMPTS.VALIDATION(transcript);

export const ANGLE_PROMPTS: Record<Angle, (transcript: string, validation: ValidationResult) => string> = {
  validate: PROMPTS.ANGLE_VALIDATE,
  expand:   PROMPTS.ANGLE_EXPAND,
  monetize: PROMPTS.ANGLE_MONETIZE,
  research: PROMPTS.ANGLE_RESEARCH,
  pitch:    PROMPTS.ANGLE_PITCH,
};

// ── Service class ──────────────────────────────────────────────────────────

class GeminiPipelineService {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
      if (apiKey) {
        this.genAI = new GoogleGenAI({ apiKey });
      } else {
        console.warn('EXPO_PUBLIC_GEMINI_API_KEY not found — geminiPipeline disabled');
      }
    } catch (error) {
      console.warn('Failed to initialize GeminiPipelineService:', error);
    }
  }

  private async callGemini(prompt: string): Promise<string> {
    if (!this.genAI) {
      throw new Error('Gemini API not initialized — check EXPO_PUBLIC_GEMINI_API_KEY');
    }
    const result = await this.genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    }) as any;
    return (result.text ?? '').trim();
  }

  async validateIdea(transcript: string): Promise<ValidationResult> {
    const raw = await this.callGemini(VALIDATION_PROMPT(transcript));
    return parseJsonResponse<ValidationResult>(raw, 'Gemini validation');
  }

  async analyseAngle(
    transcript: string,
    validation: ValidationResult,
    angle: Angle,
  ): Promise<AngleResult> {
    const raw = await this.callGemini(ANGLE_PROMPTS[angle](transcript, validation));
    return parseJsonResponse<AngleResult>(raw, `Gemini angle "${angle}"`);
  }
}

// ── Singleton exports ──────────────────────────────────────────────────────

const geminiPipelineService = new GeminiPipelineService();

export const validateIdea = (transcript: string) =>
  geminiPipelineService.validateIdea(transcript);

export const analyseAngle = (
  transcript: string,
  validation: ValidationResult,
  angle: Angle,
) => geminiPipelineService.analyseAngle(transcript, validation, angle);

// ── Provider object ────────────────────────────────────────────────────────

export const geminiProvider: PipelineProvider = {
  validateIdea,
  analyseAngle,
};
