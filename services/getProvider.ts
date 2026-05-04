import { geminiProvider } from './geminiPipeline';
import { claudeProvider } from './claudeProvider';
import { getSettings } from './settings';
import type { PipelineProvider, AIProvider } from './aiProvider';

let cachedProvider: PipelineProvider | null = null;
let cachedAiProvider: AIProvider | null = null;

export async function getProvider(): Promise<PipelineProvider> {
  const { aiProvider } = await getSettings();
  if (cachedProvider && cachedAiProvider === aiProvider) {
    return cachedProvider;
  }
  cachedAiProvider = aiProvider;
  cachedProvider = aiProvider === 'claude' ? claudeProvider : geminiProvider;
  return cachedProvider;
}
