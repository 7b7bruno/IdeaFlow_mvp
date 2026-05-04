import Anthropic from '@anthropic-ai/sdk';
import { VALIDATION_PROMPT, ANGLE_PROMPTS } from './geminiPipeline';
import type { ValidationResult, Angle, AngleResult } from './aiProvider';
import type { PipelineProvider } from './aiProvider';

const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
if (!apiKey) {
  console.warn('EXPO_PUBLIC_ANTHROPIC_API_KEY not found — Claude provider will fail');
}

const client = new Anthropic({
  apiKey,
});

function stripFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

async function callClaude(prompt: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
  return block.text;
}

export const claudeProvider: PipelineProvider = {
  async validateIdea(transcript: string): Promise<ValidationResult> {
    const raw = await callClaude(VALIDATION_PROMPT(transcript));
    const cleaned = stripFences(raw);
    try {
      return JSON.parse(cleaned) as ValidationResult;
    } catch {
      const err = new Error('Failed to parse Claude validation response') as any;
      err.rawResponse = raw;
      throw err;
    }
  },

  async analyseAngle(
    transcript: string,
    validation: ValidationResult,
    angle: Angle,
  ): Promise<AngleResult> {
    const raw = await callClaude(ANGLE_PROMPTS[angle](transcript, validation));
    const cleaned = stripFences(raw);
    try {
      return JSON.parse(cleaned) as AngleResult;
    } catch {
      const err = new Error(`Failed to parse Claude angle response for "${angle}"`) as any;
      err.rawResponse = raw;
      throw err;
    }
  },
};
