export function stripFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export function parseJsonResponse<T>(raw: string, context: string): T {
  const cleaned = stripFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const err = new Error(`Failed to parse ${context} response`) as any;
    err.rawResponse = raw;
    throw err;
  }
}
