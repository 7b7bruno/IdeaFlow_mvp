import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AIProvider } from './aiProvider';

const KEY = 'ideaflow_settings';

export type Settings = {
  aiProvider: AIProvider;
};

const defaults: Settings = { aiProvider: 'gemini' };

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

export async function saveSettings(s: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...s }));
}
