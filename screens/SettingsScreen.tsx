import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSettings, saveSettings } from '../services/settings';
import type { AIProvider } from '../services/aiProvider';

export default function SettingsScreen() {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    getSettings()
      .then(s => setSelectedProvider(s.aiProvider))
      .catch(() => setLoadError(true));
  }, []);

  const handleSelect = async (provider: AIProvider) => {
    const previous = selectedProvider;
    setSelectedProvider(provider);
    try {
      await saveSettings({ aiProvider: provider });
    } catch {
      setSelectedProvider(previous);
      Alert.alert('Error', 'Could not save your selection. Please try again.');
    }
  };

  if (loadError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.heading}>Settings</Text>
          <Text style={styles.note}>Could not load settings. Please restart the app.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedProvider === null) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>AI Provider</Text>
        <Text style={styles.note}>Used for idea validation and analysis. Changes apply to the next idea you analyse.</Text>
        <Text style={styles.note}>Transcription always uses Gemini — Claude doesn't support audio input.</Text>

        <TouchableOpacity
          style={[styles.option, selectedProvider === 'gemini' && styles.optionActive]}
          onPress={() => handleSelect('gemini')}
        >
          <Text style={[styles.optionLabel, selectedProvider === 'gemini' && styles.optionLabelActive]}>
            Gemini
          </Text>
          <Text style={[styles.optionModel, selectedProvider === 'gemini' && styles.optionModelActive]}>
            Google Gemini 2.5 Flash
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, selectedProvider === 'claude' && styles.optionActive]}
          onPress={() => handleSelect('claude')}
        >
          <Text style={[styles.optionLabel, selectedProvider === 'claude' && styles.optionLabelActive]}>
            Claude
          </Text>
          <Text style={[styles.optionModel, selectedProvider === 'claude' && styles.optionModelActive]}>
            Claude Haiku 4.5
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    padding: 24,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 6,
  },
  note: {
    fontSize: 13,
    color: '#888',
    marginBottom: 24,
  },
  option: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  optionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f7ff',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  optionLabelActive: {
    color: '#007AFF',
  },
  optionModel: {
    fontSize: 13,
    color: '#888',
  },
  optionModelActive: {
    color: '#007AFF',
  },
});
