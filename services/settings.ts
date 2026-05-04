import * as FileSystem from 'expo-file-system';
import type { AIProvider } from './aiProvider';

const SETTINGS_PATH = FileSystem.documentDirectory + 'ideaflow_settings.json';

export type Settings = {
  aiProvider: AIProvider;
};

const defaults: Settings = { aiProvider: 'gemini' };

export async function getSettings(): Promise<Settings> {
  try {
    const info = await FileSystem.getInfoAsync(SETTINGS_PATH);
    if (!info.exists) return defaults;
    const raw = await FileSystem.readAsStringAsync(SETTINGS_PATH);
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export async function saveSettings(s: Partial<Settings>): Promise<void> {
  try {
    const current = await getSettings();
    await FileSystem.writeAsStringAsync(SETTINGS_PATH, JSON.stringify({ ...current, ...s }));
  } catch (error) {
    console.warn('Failed to save settings:', error);
    throw new Error('Could not save settings. Please try again.');
  }
}
