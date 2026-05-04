import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Directory, File, Paths } from 'expo-file-system';
import { useAudioRecording } from '../hooks/useAudioRecording';
import { useTranscription } from '../hooks/useTranscription';
import { useTitleGeneration } from '../hooks/useTitleGeneration';
import { createIdea, updateIdea, getIdeaById } from '../services/database';
import { getProvider } from '../services/getProvider';
import { theme } from '../constants/theme';
import type { ValidationResult, Angle, AngleResult } from '../services/aiProvider';

type RootStackParamList = {
  Main: undefined;
  IdeasList: undefined;
  IdeaDetail: { ideaId: string };
  Settings: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

type Status = 'idle' | 'recording' | 'processing' | 'result';

const WAVE_HEIGHTS = [8, 14, 22, 30, 36, 30, 38, 26, 18, 30, 38, 22, 14, 8];

const ANGLES: { angle: Angle; emoji: string; name: string; sub: string }[] = [
  { angle: 'validate', emoji: '🎯', name: 'Validate',  sub: 'stress-test it' },
  { angle: 'expand',   emoji: '🚀', name: 'Expand',    sub: 'think bigger' },
  { angle: 'monetize', emoji: '💰', name: 'Monetize',  sub: 'who pays' },
  { angle: 'research', emoji: '🔬', name: 'Research',  sub: 'key unknowns' },
  { angle: 'pitch',    emoji: '📣', name: 'Pitch',     sub: '3-sentence version' },
];

export default function MainScreen({ navigation }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [lastSavedIdeaId, setLastSavedIdeaId] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [recordingDurationSaved, setRecordingDurationSaved] = useState(0);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [angleResults, setAngleResults] = useState<Partial<Record<Angle, AngleResult>>>({});
  const [loadingAngle, setLoadingAngle] = useState<Angle | null>(null);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  // Timer
  const timerRef = useRef<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const dotLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const waveAnims = useRef(WAVE_HEIGHTS.map(() => new Animated.Value(0.3))).current;
  const waveLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const {
    recordingDuration,
    error,
    isRecording,
    startRecording,
    stopRecording,
    clearError,
  } = useAudioRecording();

  const {
    transcribeAudio,
    clearTranscription,
    clearError: clearTranscriptionError,
  } = useTranscription();

  const { generateTitle } = useTitleGeneration();

  // Check if saved idea still exists when returning to screen
  useFocusEffect(
    React.useCallback(() => {
      if (lastSavedIdeaId) {
        getIdeaById(lastSavedIdeaId).then(idea => {
          if (!idea) {
            clearTranscription();
            setLastSavedIdeaId(null);
          }
        }).catch(err => {
          console.error('Error checking idea:', err);
        });
      }
    }, [lastSavedIdeaId])
  );

  // ── Animations ──────────────────────────────────────────────────────────────

  const startWaveAnimation = () => {
    const animations = waveAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 60),
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      )
    );
    waveLoopRef.current = Animated.parallel(animations);
    waveLoopRef.current.start();
  };

  const stopWaveAnimation = () => {
    waveLoopRef.current?.stop();
    waveAnims.forEach(a => a.setValue(0.3));
  };

  const startSpinner = () => {
    spinAnim.setValue(0);
    spinLoopRef.current = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 900, useNativeDriver: true })
    );
    spinLoopRef.current.start();
  };

  const stopSpinner = () => {
    spinLoopRef.current?.stop();
    spinAnim.setValue(0);
  };

  const startDotPulse = () => {
    dotLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    dotLoopRef.current.start();
  };

  const stopDotPulse = () => {
    dotLoopRef.current?.stop();
    dotOpacity.setValue(1);
  };

  const transitionTo = (next: Status) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
      setStatus(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 90, useNativeDriver: true }).start();
    });
  };

  useEffect(() => {
    if (status === 'recording') {
      startWaveAnimation();
      startDotPulse();
      setTimerSeconds(0);
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      stopWaveAnimation();
      stopDotPulse();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    if (status === 'processing') {
      startSpinner();
    } else {
      stopSpinner();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  useEffect(() => {
    return () => {
      stopWaveAnimation();
      stopDotPulse();
      stopSpinner();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleMicPress = async () => {
    if (error) { clearError(); return; }
    clearTranscription();
    setLastSavedIdeaId(null);
    setTranscript(null);
    setValidation(null);
    setAngleResults({});
    transitionTo('recording');
    try {
      await startRecording();
    } catch (e) {
      console.error('Error starting recording:', e);
      transitionTo('idle');
    }
  };

  const handleStopPress = async () => {
    setRecordingDurationSaved(recordingDuration);
    transitionTo('processing');
    try {
      const recordingUri = await stopRecording();
      if (!recordingUri) { transitionTo('idle'); return; }

      const file = new File(recordingUri);
      const fileExists = file.exists;

      const now = new Date();
      const title = `Idea - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
      const savedIdea = await createIdea(title, recordingUri);
      setLastSavedIdeaId(savedIdea.id);

      if (fileExists) {
        try {
          const result = await transcribeAudio(recordingUri);
          if (result?.transcription) {
            setTranscript(result.transcription);
            await updateIdea(savedIdea.id, { transcription: result.transcription });

            try {
              const titleResult = await generateTitle(result.transcription);
              if (titleResult?.title) {
                await updateIdea(savedIdea.id, { title: titleResult.title });
              }
            } catch (e) {
              console.error('Title generation error:', e);
            }

            try {
              const provider = await getProvider();
              const validationResult = await provider.validateIdea(result.transcription);
              await updateIdea(savedIdea.id, { validation: JSON.stringify(validationResult) });
              setValidation(validationResult);
            } catch (e) {
              console.warn('Validation error:', e);
            }
          }
        } catch (e) {
          console.error('Transcription error:', e);
        }
      }
      transitionTo('result');
    } catch (e) {
      console.error('Error stopping recording:', e);
      transitionTo('idle');
    }
  };

  const handleAnglePress = async (angle: Angle) => {
    if (!transcript || !validation || loadingAngle) return;
    setLoadingAngle(angle);
    try {
      const provider = await getProvider();
      const result = await provider.analyseAngle(transcript, validation, angle);
      setAngleResults(prev => ({ ...prev, [angle]: result }));
    } catch (e) {
      console.warn('Angle analysis failed:', e);
    } finally {
      setLoadingAngle(null);
    }
  };

  const handleNewIdea = () => {
    stopWaveAnimation();
    stopDotPulse();
    stopSpinner();
    setTranscript(null);
    setValidation(null);
    setAngleResults({});
    setLoadingAngle(null);
    setTranscriptExpanded(false);
    transitionTo('idle');
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const signalColor = (signal?: string) => {
    if (signal === 'strong') return theme.colors.accent;
    if (signal === 'weak') return theme.colors.danger;
    return theme.colors.warning;
  };

  // ── Render helpers ─────────────────────────────────────────────────────────────

  const renderIdle = () => (
    <View style={styles.centeredState}>
      <Text style={styles.newIdeaLabel}>NEW IDEA</Text>
      <TouchableOpacity style={styles.micButton} onPress={handleMicPress} activeOpacity={0.8}>
        <MicIcon size={32} color={theme.colors.accent} />
      </TouchableOpacity>
      <Text style={styles.hintText}>tap to speak your idea</Text>
    </View>
  );

  const renderRecording = () => (
    <View style={styles.centeredState}>
      <View style={styles.recIndicatorRow}>
        <Animated.View style={[styles.recDot, { opacity: dotOpacity }]} />
        <Text style={styles.recLabel}>RECORDING</Text>
      </View>

      <View style={styles.waveform}>
        {WAVE_HEIGHTS.map((h, i) => (
          <Animated.View
            key={i}
            style={[
              styles.waveBar,
              { height: h, transform: [{ scaleY: waveAnims[i] }] },
            ]}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.stopButton} onPress={handleStopPress} activeOpacity={0.8}>
        <View style={styles.stopSquare} />
      </TouchableOpacity>

      <Text style={styles.timerText}>{formatTimer(timerSeconds)}</Text>
    </View>
  );

  const renderProcessing = () => (
    <View style={styles.centeredState}>
      <Animated.View style={[styles.spinner, { transform: [{ rotate: spinInterpolate }] }]} />
      <Text style={styles.processingLabel}>Analysing idea...</Text>
    </View>
  );

  const renderResult = () => (
    <>
      <ScrollView
        style={styles.resultScroll}
        contentContainerStyle={styles.resultContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Transcript pill */}
        <TouchableOpacity
          style={styles.transcriptPill}
          onPress={() => setTranscriptExpanded(e => !e)}
          activeOpacity={0.8}
        >
          <View style={styles.transcriptLeft}>
            <MicIcon size={20} color={theme.colors.accent} />
          </View>
          <View style={styles.transcriptRight}>
            <Text style={styles.transcriptLabel}>
              TRANSCRIPT · {formatDuration(recordingDurationSaved)}
            </Text>
            {transcriptExpanded ? (
              <Text style={styles.transcriptFull}>{transcript ?? ''}</Text>
            ) : (
              <Text style={styles.transcriptPreview} numberOfLines={1}>
                {transcript ?? ''}
              </Text>
            )}
            <Text style={styles.transcriptHint}>
              {transcriptExpanded ? 'tap to collapse' : 'tap to expand'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Validation card */}
        {validation && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderLabel}>QUICK VALIDATION</Text>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreBadgeText}>{validation.score} / 10</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.verdictRow}>
              <View style={[styles.signalDot, { backgroundColor: signalColor(validation.signal) }]} />
              <Text style={styles.verdictText}>{validation.verdict}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.valRow}>
              <Text style={styles.valLabel}>STRONG</Text>
              <Text style={[styles.valValue, { color: theme.colors.accent }]}>{validation.strong}</Text>
            </View>
            <View style={styles.valRow}>
              <Text style={styles.valLabel}>RISK</Text>
              <Text style={[styles.valValue, { color: theme.colors.danger }]}>{validation.risk}</Text>
            </View>
            <View style={styles.valRow}>
              <Text style={styles.valLabel}>VERDICT</Text>
              <Text style={styles.valValue}>{validation.recommendation}</Text>
            </View>
          </View>
        )}

        {/* Angle buttons — only if validation exists */}
        {validation && (
          <View style={styles.anglesSection}>
            <Text style={styles.anglesSectionLabel}>TAKE THIS FURTHER</Text>
            <View style={styles.anglesGrid}>
              {ANGLES.slice(0, 4).map(({ angle, emoji, name, sub }) => (
                <AngleButton
                  key={angle}
                  angle={angle}
                  emoji={emoji}
                  name={name}
                  sub={sub}
                  loading={loadingAngle === angle}
                  active={!!angleResults[angle]}
                  onPress={() => handleAnglePress(angle)}
                  style={styles.angleButtonHalf}
                />
              ))}
            </View>
            <AngleButton
              angle="pitch"
              emoji="📣"
              name="Pitch"
              sub="3-sentence version"
              loading={loadingAngle === 'pitch'}
              active={!!angleResults['pitch']}
              onPress={() => handleAnglePress('pitch')}
              style={styles.angleButtonFull}
            />
          </View>
        )}

        {/* Angle result cards */}
        {ANGLES.map(({ angle, name }) => {
          const result = angleResults[angle];
          if (!result) return null;
          return (
            <AngleResultCard key={angle} angle={angle} name={name} result={result} />
          );
        })}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.newIdeaButton} onPress={handleNewIdea} activeOpacity={0.8}>
          <Text style={styles.newIdeaPlus}>+</Text>
          <Text style={styles.newIdeaButtonText}>New idea</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>IdeaFlow</Text>
        <View style={styles.headerRight}>
          <View style={styles.headerDot} />
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsLink}>
            <Text style={styles.settingsLinkText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
        {status === 'idle' && renderIdle()}
        {status === 'recording' && renderRecording()}
        {status === 'processing' && renderProcessing()}
        {status === 'result' && renderResult()}
      </Animated.View>

      {/* View all — only in idle/result */}
      {(status === 'idle' || status === 'result') && (
        <TouchableOpacity style={styles.viewAllLink} onPress={() => navigation.navigate('IdeasList')}>
          <Text style={styles.viewAllText}>View All Ideas</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MicIcon({ size, color }: { size: number; color: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Body */}
      <View style={{
        width: size * 0.38,
        height: size * 0.55,
        borderRadius: size * 0.19,
        borderWidth: 2,
        borderColor: color,
        position: 'absolute',
        top: 0,
      }} />
      {/* Stand arc */}
      <View style={{
        width: size * 0.6,
        height: size * 0.32,
        borderBottomLeftRadius: size * 0.3,
        borderBottomRightRadius: size * 0.3,
        borderWidth: 2,
        borderColor: color,
        borderTopWidth: 0,
        position: 'absolute',
        bottom: size * 0.1,
      }} />
      {/* Stem */}
      <View style={{
        width: 2,
        height: size * 0.14,
        backgroundColor: color,
        position: 'absolute',
        bottom: 0,
      }} />
    </View>
  );
}

function AngleButton({
  angle, emoji, name, sub, loading, active, onPress, style,
}: {
  angle: Angle; emoji: string; name: string; sub: string;
  loading: boolean; active: boolean; onPress: () => void; style?: object;
}) {
  return (
    <TouchableOpacity
      style={[
        angleStyles.button,
        active && angleStyles.buttonActive,
        style,
      ]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <AngleSpinner />
      ) : (
        <>
          <Text style={angleStyles.emoji}>{emoji}</Text>
          <Text style={angleStyles.name}>{name}</Text>
          <Text style={angleStyles.sub}>{sub}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function AngleSpinner() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 700, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={[angleStyles.spinner, { transform: [{ rotate }] }]} />
  );
}

function AngleResultCard({ angle, name, result }: { angle: Angle; name: string; result: AngleResult }) {
  const entries = Object.entries(result as Record<string, unknown>);
  return (
    <View style={resultCardStyles.card}>
      <View style={resultCardStyles.headerRow}>
        <Text style={resultCardStyles.headerLabel}>{name.toUpperCase()} ANALYSIS</Text>
      </View>
      <View style={resultCardStyles.divider} />
      {entries.map(([key, value]) => (
        <View key={key} style={resultCardStyles.row}>
          <Text style={resultCardStyles.key}>{key.toUpperCase()}</Text>
          <Text style={resultCardStyles.value}>
            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const { colors, radius, font } = theme;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: font.title,
    color: colors.textPrimary,
    fontWeight: '500',
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  settingsLink: {
    paddingVertical: 2,
  },
  settingsLinkText: {
    fontSize: font.small,
    color: colors.textMuted,
  },
  body: {
    flex: 1,
  },
  // Idle / recording / processing
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  newIdeaLabel: {
    fontSize: font.tiny,
    color: colors.textDim,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  micButton: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.accentDim,
    borderWidth: 1.5,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    fontSize: font.small,
    color: colors.borderDim,
  },
  // Recording state
  recIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.recDot,
  },
  recLabel: {
    fontSize: font.tiny,
    color: colors.recDot,
    letterSpacing: 4,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginVertical: 4,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.recBg,
    borderWidth: 1.5,
    borderColor: colors.recBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: colors.recDot,
  },
  timerText: {
    fontSize: font.label,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  // Processing state
  spinner: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.borderDim,
    borderTopColor: colors.accent,
  },
  processingLabel: {
    fontSize: font.body,
    color: colors.textDim,
    letterSpacing: 1,
  },
  // Result state
  resultScroll: {
    flex: 1,
  },
  resultContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  // Transcript pill
  transcriptPill: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    paddingHorizontal: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  transcriptLeft: {
    paddingTop: 2,
  },
  transcriptRight: {
    flex: 1,
  },
  transcriptLabel: {
    fontSize: font.tiny,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 3,
  },
  transcriptPreview: {
    fontSize: font.body,
    color: colors.textMuted,
  },
  transcriptFull: {
    fontSize: font.body,
    color: colors.textMuted,
    lineHeight: 18,
  },
  transcriptHint: {
    fontSize: font.tiny,
    color: colors.accent,
    marginTop: 3,
  },
  // Validation card
  card: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardHeaderLabel: {
    fontSize: font.tiny,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  scoreBadge: {
    backgroundColor: colors.warningBg,
    borderWidth: 0.5,
    borderColor: colors.warningBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scoreBadgeText: {
    fontSize: font.small,
    color: colors.warning,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.borderDim,
    marginVertical: 8,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  verdictText: {
    fontSize: font.label,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  valRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    alignItems: 'flex-start',
  },
  valLabel: {
    fontSize: font.tiny,
    color: colors.textDim,
    textTransform: 'uppercase',
    minWidth: 52,
    paddingTop: 1,
  },
  valValue: {
    fontSize: font.small,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 17,
  },
  // Angle buttons
  anglesSection: {
    gap: 6,
  },
  anglesSectionLabel: {
    fontSize: font.tiny,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 2,
  },
  anglesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  angleButtonHalf: {
    flex: 1,
    minWidth: '45%',
  },
  angleButtonFull: {
    width: '100%',
  },
  // Bottom bar
  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  newIdeaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accentDim,
    borderWidth: 0.5,
    borderColor: colors.accentBorder,
    borderRadius: radius.md,
    padding: 12,
  },
  newIdeaPlus: {
    fontSize: 14,
    color: colors.accent,
    lineHeight: 14,
  },
  newIdeaButtonText: {
    fontSize: font.body,
    color: colors.accent,
    letterSpacing: 1,
  },
  // View all
  viewAllLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  viewAllText: {
    fontSize: font.small,
    color: colors.textMuted,
  },
});

const angleStyles = StyleSheet.create({
  button: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    alignItems: 'flex-start',
    minHeight: 70,
    justifyContent: 'center',
  },
  buttonActive: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentDim,
  },
  emoji: {
    fontSize: font.label,
    marginBottom: 3,
  },
  name: {
    fontSize: font.small,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  sub: {
    fontSize: font.tiny,
    color: colors.textDim,
    marginTop: 1,
  },
  spinner: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.borderDim,
    borderTopColor: colors.accent,
    alignSelf: 'center',
  },
});

const resultCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  headerRow: {
    marginBottom: 2,
  },
  headerLabel: {
    fontSize: font.tiny,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.borderDim,
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    alignItems: 'flex-start',
  },
  key: {
    fontSize: font.tiny,
    color: colors.textDim,
    textTransform: 'uppercase',
    minWidth: 70,
    paddingTop: 1,
  },
  value: {
    fontSize: font.small,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 17,
  },
});
