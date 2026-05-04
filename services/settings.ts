import { File, Paths } from 'expo-file-system';
import type { AIProvider } from './aiProvider';

const getSettingsFile = () => new File(Paths.document, 'ideaflow_settings.json');

export type Settings = {
  aiProvider: AIProvider;
};

const defaults: Settings = { aiProvider: 'gemini' };

export async function getSettings(): Promise<Settings> {
  try {
    const file = getSettingsFile();
    if (!file.exists) return defaults;
    const raw = await file.text();
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export async function saveSettings(s: Partial<Settings>): Promise<void> {
  try {
    const current = await getSettings();
    const file = getSettingsFile();
    await file.write(JSON.stringify({ ...current, ...s }));
  } catch (error) {
    console.warn('Failed to save settings:', error);
    throw new Error('Could not save settings. Please try again.');
  }
}
