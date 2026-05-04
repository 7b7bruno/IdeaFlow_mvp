import { stripFences, parseJsonResponse } from '../services/parseJson';

describe('stripFences', () => {
  it('returns plain JSON unchanged', () => {
    const input = '{"score": 7}';
    expect(stripFences(input)).toBe('{"score": 7}');
  });

  it('strips ```json ... ``` fences', () => {
    const input = '```json\n{"score": 7}\n```';
    expect(stripFences(input)).toBe('{"score": 7}');
  });

  it('strips plain ``` ... ``` fences', () => {
    const input = '```\n{"score": 7}\n```';
    expect(stripFences(input)).toBe('{"score": 7}');
  });

  it('is case-insensitive on the json label', () => {
    const input = '```JSON\n{"score": 7}\n```';
    expect(stripFences(input)).toBe('{"score": 7}');
  });

  it('trims surrounding whitespace', () => {
    const input = '  {"score": 7}  ';
    expect(stripFences(input)).toBe('{"score": 7}');
  });
});

describe('parseJsonResponse', () => {
  it('parses valid JSON after stripping fences', () => {
    const raw = '```json\n{"score": 8, "verdict": "Strong"}\n```';
    const result = parseJsonResponse<{ score: number; verdict: string }>(raw, 'test');
    expect(result.score).toBe(8);
    expect(result.verdict).toBe('Strong');
  });

  it('throws with context label and attaches rawResponse on invalid JSON', () => {
    const raw = 'not json at all';
    let caught: any;
    try {
      parseJsonResponse(raw, 'validation');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.message).toContain('validation');
    expect(caught.rawResponse).toBe('not json at all');
  });
});
