import { GoogleGenAI } from '@google/genai';
import type { PipelineProvider, ValidationResult, Angle, AngleResult } from './aiProvider';

// Re-export domain types for backwards compatibility
export type { ValidationResult, Angle, AngleResult } from './aiProvider';

// ── Prompts ────────────────────────────────────────────────────────────────

export const VALIDATION_PROMPT = (transcript: string) => `
You are a sharp, honest startup idea evaluator. A founder just recorded this voice note:

"${transcript}"

Evaluate this idea quickly. Be direct and willing to say if it's weak.
Respond ONLY with a JSON object, no markdown, no explanation outside the JSON.

{
  "score": <integer 1-10>,
  "verdict": <one short phrase, e.g. "Interesting but unproven">,
  "signal": <"strong" | "neutral" | "weak">,
  "strong": <one sentence on what's genuinely good, or "Nothing stands out yet">,
  "risk": <one sentence on the single biggest problem or assumption>,
  "recommendation": <one sentence on whether to pursue and what the next step is>
}
`;

export const ANGLE_PROMPTS: Record<Angle, (transcript: string, validation: ValidationResult) => string> = {
  validate: (transcript, validation) => `
You are a rigorous product critic. A founder had this idea:
"${transcript}"
Initial validation: ${validation.verdict} (${validation.score}/10)
Biggest risk flagged: ${validation.risk}

Stress-test this idea. Find critical assumptions and rank by how likely they are to kill the idea.
Respond ONLY with JSON, no markdown.

{
  "assumptions": [
    {
      "assumption": <the assumption being made>,
      "riskLevel": <"high" | "medium" | "low">,
      "whyItMatters": <one sentence>,
      "howToTest": <one concrete fast way to validate — no building required>
    }
  ],
  "killerQuestion": <the single question that if answered badly kills the idea>,
  "verdict": <one honest sentence summary>
}
`,

  expand: (transcript, validation) => `
You are an ambitious product strategist. A founder had this idea:
"${transcript}"
Initial validation: ${validation.verdict} (${validation.score}/10)

Show three versions of this idea at different scopes.
Respond ONLY with JSON, no markdown.

{
  "versions": [
    {
      "scope": "feature",
      "description": <what this looks like as a small focused feature>,
      "bestFor": <who this version is best for>
    },
    {
      "scope": "product",
      "description": <what this looks like as a standalone product>,
      "bestFor": <who this version is best for>
    },
    {
      "scope": "platform",
      "description": <what this looks like as a platform or ecosystem play>,
      "bestFor": <who this version is best for>
    }
  ],
  "recommendation": <which scope to pursue first and why, one sentence>
}
`,

  monetize: (transcript, validation) => `
You are a pragmatic business model expert. A founder had this idea:
"${transcript}"
Initial validation: ${validation.verdict} (${validation.score}/10)

Identify realistic ways to make money from this. Be specific about who pays and what for.
Respond ONLY with JSON, no markdown.

{
  "models": [
    {
      "name": <e.g. "SaaS subscription", "marketplace take rate">,
      "whoPays": <the specific person or role writing the check>,
      "whatTheyPayFor": <the specific outcome or value they are buying>,
      "roughPricing": <realistic price range with brief rationale>,
      "feasibility": <"high" | "medium" | "low">
    }
  ],
  "recommended": <index of recommended model, 0-based>,
  "biggestMonetizationRisk": <one sentence>
}
`,

  research: (transcript, validation) => `
You are a methodical product researcher. A founder had this idea:
"${transcript}"
Initial validation: ${validation.verdict} (${validation.score}/10)
Biggest risk: ${validation.risk}

List key things this founder must find out before writing any code. Most important first.
Respond ONLY with JSON, no markdown.

{
  "questions": [
    {
      "question": <the specific thing to find out>,
      "whyItMatters": <one sentence on what breaks if this is wrong>,
      "howToAnswer": <fastest way to get a real answer>,
      "timeEstimate": <e.g. "2 hours", "1 day">
    }
  ],
  "firstAction": <the single most important thing to do in the next 24 hours>
}
`,

  pitch: (transcript, validation) => `
You are a pitch coach who has seen thousands of startup pitches. A founder had this idea:
"${transcript}"
Initial validation: ${validation.verdict} (${validation.score}/10)

Write a crisp 3-sentence pitch. Sentence 1: the problem. Sentence 2: the solution and who
it's for. Sentence 3: why now / why this will work. Plus a tagline under 10 words.
Respond ONLY with JSON, no markdown.

{
  "tagline": <under 10 words, punchy>,
  "pitch": {
    "problem": <one sentence — the pain, who feels it, how badly>,
    "solution": <one sentence — what you built, for whom, the key insight>,
    "why": <one sentence — timing, traction, unfair advantage, or market shift>
  },
  "tweetVersion": <the whole pitch in a single tweet-length sentence>
}
`,
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

  private stripFences(text: string): string {
    return text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
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
    const cleaned = this.stripFences(raw);
    try {
      return JSON.parse(cleaned) as ValidationResult;
    } catch {
      const err = new Error('Failed to parse validation response') as any;
      err.rawResponse = raw;
      throw err;
    }
  }

  async analyseAngle(
    transcript: string,
    validation: ValidationResult,
    angle: Angle,
  ): Promise<AngleResult> {
    const prompt = ANGLE_PROMPTS[angle](transcript, validation);
    const raw = await this.callGemini(prompt);
    const cleaned = this.stripFences(raw);
    try {
      return JSON.parse(cleaned) as AngleResult;
    } catch {
      const err = new Error(`Failed to parse angle response for "${angle}"`) as any;
      err.rawResponse = raw;
      throw err;
    }
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
