// ── Domain types ───────────────────────────────────────────────────────────

export type ValidationResult = {
  score: number;
  verdict: string;
  signal: 'strong' | 'neutral' | 'weak';
  strong: string;
  risk: string;
  recommendation: string;
};

export type Angle = 'validate' | 'expand' | 'monetize' | 'research' | 'pitch';

export type AngleResult = Record<string, unknown>;

// ── Provider types ─────────────────────────────────────────────────────────

export type AIProvider = 'gemini' | 'claude';

export interface PipelineProvider {
  validateIdea(transcript: string): Promise<ValidationResult>;
  analyseAngle(
    transcript: string,
    validation: ValidationResult,
    angle: Angle,
  ): Promise<AngleResult>;
}
