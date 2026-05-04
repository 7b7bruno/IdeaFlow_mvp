import type { ValidationResult, Angle, AngleResult } from './geminiPipeline';

export type AIProvider = 'gemini' | 'claude';

export interface PipelineProvider {
  validateIdea(transcript: string): Promise<ValidationResult>;
  analyseAngle(
    transcript: string,
    validation: ValidationResult,
    angle: Angle,
  ): Promise<AngleResult>;
}
