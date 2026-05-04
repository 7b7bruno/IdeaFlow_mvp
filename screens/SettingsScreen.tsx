import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSettings, saveSettings } from '../services/settings';
import type { AIProvider } from '../services/aiProvider';
import { theme } from '../constants/theme';
import AppAlert from '../components/AppAlert';
import { useAppAlert } from '../hooks/useAppAlert';

export default function SettingsScreen() {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [loadError, setLoadError] = useState(false);
  const { alertState, showAlert, hideAlert } = useAppAlert();

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
      showAlert('Error', 'Could not save your selection. Please try again.');
    }
  };

  if (loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.content}>
          <Text style={styles.note}>Could not load settings. Please restart the app.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedProvider === null) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <Text style={styles.sectionLabel}>AI PROVIDER</Text>
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
      <AppAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onDismiss={hideAlert}
      />
    </SafeAreaView>
  );
}

const { colors, radius, font } = theme;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: font.tiny,
    color: colors.textDim,
    letterSpacing: 3,
    marginBottom: 8,
  },
  note: {
    fontSize: font.small,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 17,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  optionActive: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentDim,
  },
  optionLabel: {
    fontSize: font.label,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  optionLabelActive: {
    color: colors.accent,
  },
  optionModel: {
    fontSize: font.small,
    color: colors.textMuted,
  },
  optionModelActive: {
    color: colors.accent,
  },
});
