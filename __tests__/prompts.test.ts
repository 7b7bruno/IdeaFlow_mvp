import { PROMPTS } from '../config/prompts';

const mockValidation = {
  score: 7,
  verdict: 'Interesting but unproven',
  signal: 'neutral' as const,
  strong: 'Clear problem statement',
  risk: 'No evidence of demand',
  recommendation: 'Talk to 10 potential customers first',
};

describe('PROMPTS', () => {
  describe('TRANSCRIPTION_CLEANUP', () => {
    it('is a non-empty string', () => {
      expect(typeof PROMPTS.TRANSCRIPTION_CLEANUP).toBe('string');
      expect(PROMPTS.TRANSCRIPTION_CLEANUP.length).toBeGreaterThan(0);
    });

    it('instructs the model to return only the transcription', () => {
      expect(PROMPTS.TRANSCRIPTION_CLEANUP).toContain('Return only the clean transcription');
    });
  });

  describe('TITLE_GENERATION', () => {
    it('is a non-empty string', () => {
      expect(typeof PROMPTS.TITLE_GENERATION).toBe('string');
      expect(PROMPTS.TITLE_GENERATION.length).toBeGreaterThan(0);
    });

    it('instructs the model to return only the title', () => {
      expect(PROMPTS.TITLE_GENERATION).toContain('Return only the title');
    });
  });

  describe('VALIDATION', () => {
    it('returns a string containing the transcript', () => {
      const transcript = 'An app that tracks water intake';
      const prompt = PROMPTS.VALIDATION(transcript);
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain(transcript);
    });

    it('instructs JSON-only output', () => {
      const prompt = PROMPTS.VALIDATION('test idea');
      expect(prompt).toContain('JSON');
    });
  });

  describe('angle prompts', () => {
    const angles = [
      'ANGLE_VALIDATE',
      'ANGLE_EXPAND',
      'ANGLE_MONETIZE',
      'ANGLE_RESEARCH',
      'ANGLE_PITCH',
    ] as const;

    for (const angle of angles) {
      it(`${angle} returns a string containing the transcript and instructs JSON output`, () => {
        const transcript = 'A marketplace for local farmers';
        const prompt = PROMPTS[angle](transcript, mockValidation);
        expect(typeof prompt).toBe('string');
        expect(prompt).toContain(transcript);
        expect(prompt).toContain('JSON');
      });
    }
  });
});
