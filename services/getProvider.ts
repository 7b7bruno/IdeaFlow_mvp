import { geminiProvider } from './geminiPipeline';
import { claudeProvider } from './claudeProvider';
import { getSettings } from './settings';
import type { PipelineProvider } from './aiProvider';

export async function getProvider(): Promise<PipelineProvider> {
  const { aiProvider } = await getSettings();
  return aiProvider === 'claude' ? claudeProvider : geminiProvider;
}
