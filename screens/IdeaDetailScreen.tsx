import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAudioPlayer } from 'expo-audio';
import { File } from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getIdeaById, deleteIdea, updateIdeaTitle, type Idea } from '../services/database';
import { useTitleGeneration } from '../hooks/useTitleGeneration';
import { type ValidationResult, type Angle, type AngleResult } from '../services/aiProvider';
import { getProvider } from '../services/getProvider';

type RootStackParamList = {
  Main: undefined;
  IdeasList: undefined;
  IdeaDetail: { ideaId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'IdeaDetail'>;

export default function IdeaDetailScreen({ route, navigation }: Props) {
  const { ideaId } = route.params;
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);

  // Title editing state
  const [editedTitle, setEditedTitle] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<TextInput>(null);

  const {
    generateTitle,
    isGenerating: isTitleGenerating,
  } = useTitleGeneration();

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [angleResult, setAngleResult] = useState<AngleResult | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [activeAngle, setActiveAngle] = useState<Angle | null>(null);

  // Audio player state
  const [audioFilePath, setAudioFilePath] = useState<string | null>(null);
  const audioPlayer = useAudioPlayer(audioFilePath || '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressIntervalRef = useRef<number | null>(null);

  const loadIdea = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load idea from database
      const loadedIdea = await getIdeaById(Number(ideaId));

      if (!loadedIdea) {
        setError('Idea not found in database');
        setLoading(false);
        return;
      }

      // Check if audio file exists
      const file = new File(loadedIdea.audioPath);
      if (!file.exists) {
        setError('Audio file not found');
        setLoading(false);
        return;
      }

      const size = file.size;

      // Check if file is empty (corrupted recording)
      if (size === 0) {
        setError('Audio file is empty or corrupted');
        setLoading(false);
        return;
      }

      setFileSize(size);
      setIdea(loadedIdea);
      setEditedTitle(loadedIdea.title);
      setAudioFilePath(loadedIdea.audioPath);

    } catch (error) {
      console.error('Error loading idea:', error);
      setError('Failed to load idea');
    } finally {
      setLoading(false);
    }
  };

  const handleTitleSubmit = async () => {
    if (!idea || !editedTitle.trim()) {
      // If title is empty, reset to original
      if (!editedTitle.trim() && idea) {
        setEditedTitle(idea.title);
      }
      setIsEditingTitle(false);
      return;
    }

    try {
      const success = await updateIdeaTitle(idea.id, editedTitle.trim());
      if (success) {
        setIdea({ ...idea, title: editedTitle.trim() });
        setIsEditingTitle(false);
      }
    } catch (error) {
      console.error('Error updating title:', error);
      Alert.alert('Error', 'Failed to update title');
      setIsEditingTitle(false);
    }
  };

  const handleRegenerateTitle = async () => {
    if (!idea?.transcription) {
      Alert.alert('No Transcription', 'Cannot generate title without a transcription');
      return;
    }

    try {
      const result = await generateTitle(idea.transcription);
      if (result?.title) {
        const success = await updateIdeaTitle(idea.id, result.title);
        if (success) {
          setIdea({ ...idea, title: result.title });
          setEditedTitle(result.title);
          Alert.alert('Success', 'Title regenerated successfully!');
        }
      }
    } catch (error) {
      console.error('Error regenerating title:', error);
      Alert.alert('Error', 'Failed to regenerate title');
    }
  };

  const handleAngle = async (angle: Angle) => {
    if (!idea?.transcription || !validation || isAnalysing) return;
    setActiveAngle(angle);
    setIsAnalysing(true);
    setAngleResult(null);
    try {
      const provider = await getProvider();
      const result = await provider.analyseAngle(idea.transcription, validation, angle);
      setAngleResult(result);
    } catch (err) {
      console.warn('Angle analysis failed:', err);
      Alert.alert('Analysis Failed', 'Could not analyse this angle. Please try again.');
    } finally {
      setIsAnalysing(false);
    }
  };

  const startProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      try {
        // Get current time and duration from audio player
        if (audioPlayer.currentTime !== undefined) {
          setPlaybackPosition(audioPlayer.currentTime);
        }
        if (audioPlayer.duration !== undefined && audioPlayer.duration > 0) {
          setDuration(audioPlayer.duration);
        }

        // Check if playback finished
        if (audioPlayer.currentTime !== undefined && audioPlayer.duration !== undefined &&
          audioPlayer.currentTime >= audioPlayer.duration) {
          setIsPlaying(false);
          setPlaybackPosition(0);
          clearInterval(progressIntervalRef.current!);
          progressIntervalRef.current = null;
          // Don't seekTo(0) here as it causes the audio to replay automatically
        }
      } catch (error) {
        console.warn('Progress tracking error:', error);
      }
    }, 100);
  };

  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        await audioPlayer.pause();
        setIsPlaying(false);
        stopProgressTracking();
      } else {
        // If we're at the end (after completion), seek to start
        if (audioPlayer.duration && audioPlayer.currentTime >= audioPlayer.duration) {
          await audioPlayer.seekTo(0);
        }

        await audioPlayer.play();
        setIsPlaying(true);
        startProgressTracking();
      }
    } catch (error) {
      console.error('Playback error:', error);
      Alert.alert('Playback Error', 'Failed to play audio');
    }
  };

  const handleStop = async () => {
    try {
      // Pause the audio and seek to beginning (no stop() method exists)
      await audioPlayer.pause();
      await audioPlayer.seekTo(0);
      setPlaybackPosition(0);
      setIsPlaying(false);
      stopProgressTracking();
    } catch (error) {
      console.error('Stop error:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Idea',
      'Are you sure you want to delete this idea? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Stop playback if playing (with error handling for invalid audio player)
              if (isPlaying && audioPlayer) {
                try {
                  await audioPlayer.pause();
                  setIsPlaying(false);
                  stopProgressTracking();
                } catch (playerError) {
                  console.error('Error stopping audio player:', playerError);
                  // Continue with deletion even if player stop fails
                }
              }

              // Delete audio file
              if (idea?.audioPath) {
                try {
                  const file = new File(idea.audioPath);
                  if (file.exists) {
                    file.delete();
                  }
                } catch (fileError) {
                  console.error('Error deleting audio file:', fileError);
                }
              }

              // Delete from database
              if (idea?.id) {
                await deleteIdea(idea.id);
              }

              // Navigate back
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting idea:', error);
              Alert.alert('Error', 'Failed to delete idea. Please try again.');
            }
          }
        }
      ]
    );
  };

  const formatTime = (seconds: number): string => {
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getPlayButtonText = (): string => {
    if (isLoading) return 'Loading...';
    if (isPlaying) return 'Pause';
    return 'Play';
  };

  useEffect(() => {
    loadIdea();
  }, [ideaId]);

  useEffect(() => {
    if (idea?.transcription && !validation) {
      setIsValidating(true);
      getProvider()
        .then(provider => provider.validateIdea(idea.transcription!))
        .then(setValidation)
        .catch(err => console.warn('Validation failed:', err))
        .finally(() => setIsValidating(false));
    }
  }, [idea?.transcription, validation]);

  // Load duration when audio file is set
  useEffect(() => {
    if (audioFilePath && audioPlayer) {
      const loadDuration = () => {
        if (audioPlayer.duration !== undefined && audioPlayer.duration > 0) {
          setDuration(audioPlayer.duration);
        } else {
          // Retry after a short delay if duration not available yet
          setTimeout(loadDuration, 100);
        }
      };
      
      // Small delay to allow audio player to initialize
      setTimeout(loadDuration, 50);
    }
  }, [audioFilePath, audioPlayer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProgressTracking();
      try {
        if (audioPlayer && isPlaying) {
          audioPlayer.pause();
        }
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading recording...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !idea) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{error || 'Idea not found'}</Text>
            <View style={styles.errorButtonsContainer}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backButtonText}>Go Back</Text>
              </TouchableOpacity>
              {idea && (
                <TouchableOpacity
                  style={styles.deleteErrorButton}
                  onPress={handleDelete}
                >
                  <Text style={styles.deleteErrorButtonText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const recordedDate = new Date(idea.createdAt);
  const audioFilename = idea.audioPath.split('/').pop() || 'audio.m4a';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.headerContainer}>
          <TextInput
            ref={titleInputRef}
            style={[
              styles.titleInput,
              isEditingTitle && styles.titleInputEditing
            ]}
            value={editedTitle}
            onChangeText={(text) => {
              // Remove newlines to prevent manual line breaks
              setEditedTitle(text.replace(/\n/g, ' '));
            }}
            onFocus={() => setIsEditingTitle(true)}
            onBlur={handleTitleSubmit}
            onSubmitEditing={() => {
              handleTitleSubmit();
              titleInputRef.current?.blur();
            }}
            placeholder="Enter idea title"
            returnKeyType="done"
            blurOnSubmit={true}
            multiline
            numberOfLines={2}
          />
          <View style={styles.buttonRow}>
            {idea.transcription && (
              <TouchableOpacity
                style={[styles.regenerateButton, isTitleGenerating && styles.regenerateButtonDisabled]}
                onPress={handleRegenerateTitle}
                disabled={isTitleGenerating}
              >
                {isTitleGenerating ? (
                  <View style={styles.regenerateButtonContent}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.regenerateButtonLabel}>Regenerating...</Text>
                  </View>
                ) : (
                  <View style={styles.regenerateButtonContent}>
                    <Text style={styles.regenerateButtonText}>↻</Text>
                    <Text style={styles.regenerateButtonLabel}>Regenerate Title</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Text style={styles.deleteButtonText}>Delete Idea</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.subtitle}>{recordedDate.toLocaleString()}</Text>
        <Text style={styles.fileInfo}>
          File: {audioFilename} • Size: {(fileSize / 1024).toFixed(1)} KB
        </Text>

        {idea.transcription && (
          <View style={styles.transcriptionContainer}>
            <Text style={styles.transcriptionTitle}>Transcription</Text>
            <Text style={styles.transcriptionText}>{idea.transcription}</Text>
          </View>
        )}

        {(isValidating || validation) && (
          <View style={styles.validationContainer}>
            {isValidating ? (
              <View style={styles.validationLoadingRow}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.validationLoadingText}>Validating idea...</Text>
              </View>
            ) : validation ? (
              <>
                <Text style={styles.validationVerdict}>
                  {validation.verdict}
                </Text>
                <Text style={styles.validationMeta}>
                  Score: {validation.score}/10 · {validation.signal.toUpperCase()}
                </Text>
              </>
            ) : null}
          </View>
        )}

        {validation && (
          <View style={styles.angleButtonsContainer}>
            {(['validate', 'expand', 'monetize', 'research', 'pitch'] as Angle[]).map((angle) => (
              <TouchableOpacity
                key={angle}
                style={[
                  styles.angleButton,
                  activeAngle === angle && styles.angleButtonActive,
                  isAnalysing && styles.angleButtonDisabled,
                ]}
                onPress={() => handleAngle(angle)}
                disabled={isAnalysing}
              >
                <Text style={[
                  styles.angleButtonText,
                  activeAngle === angle && styles.angleButtonTextActive,
                ]}>
                  {angle.charAt(0).toUpperCase() + angle.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {(isAnalysing || angleResult) && (
          <View style={styles.angleResultContainer}>
            {isAnalysing ? (
              <View style={styles.validationLoadingRow}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.validationLoadingText}>Analysing...</Text>
              </View>
            ) : angleResult ? (
              <ScrollView style={styles.angleResultScroll}>
                <Text style={styles.angleResultText}>
                  {JSON.stringify(angleResult, null, 2)}
                </Text>
              </ScrollView>
            ) : null}
          </View>
        )}

        <View style={styles.playerContainer}>
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>
              {formatTime(playbackPosition)} / {formatTime(duration)}
            </Text>
          </View>

          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[
                styles.playButton,
                isLoading && styles.disabledButton
              ]}
              onPress={handlePlayPause}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.playButtonText}>{getPlayButtonText()}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.stopButton,
                (!isPlaying && playbackPosition === 0) && styles.disabledStopButton
              ]}
              onPress={handleStop}
              disabled={!isPlaying && playbackPosition === 0}
            >
              <Text style={[
                styles.stopButtonText,
                (!isPlaying && playbackPosition === 0) && styles.disabledStopButtonText
              ]}>Stop</Text>
            </TouchableOpacity>
          </View>

          {duration > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(playbackPosition / duration) * 100}%` }
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 10,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    minHeight: 48,
    maxHeight: 96,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  titleInputEditing: {
    backgroundColor: 'transparent',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  regenerateButton: {
    backgroundColor: '#E8F4FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  regenerateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  regenerateButtonDisabled: {
    opacity: 0.5,
  },
  regenerateButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  regenerateButtonLabel: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  fileInfo: {
    fontSize: 14,
    color: '#999',
    marginBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  errorButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteErrorButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  deleteErrorButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  playerContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: 'monospace',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  playButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginRight: 15,
    minWidth: 100,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#8E8E93',
  },
  playButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  stopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledStopButton: {
    backgroundColor: '#E5E5EA',
  },
  disabledStopButtonText: {
    color: '#8E8E93',
  },
  progressContainer: {
    marginTop: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  transcriptionContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  transcriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  transcriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  validationContainer: {
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  validationLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  validationLoadingText: {
    fontSize: 14,
    color: '#007AFF',
  },
  validationVerdict: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  validationMeta: {
    fontSize: 13,
    color: '#555',
  },
  angleButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  angleButton: {
    backgroundColor: '#f2f2f7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  angleButtonActive: {
    backgroundColor: '#007AFF',
  },
  angleButtonDisabled: {
    opacity: 0.5,
  },
  angleButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  angleButtonTextActive: {
    color: '#fff',
  },
  angleResultContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    maxHeight: 300,
  },
  angleResultScroll: {
    flex: 1,
  },
  angleResultText: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});