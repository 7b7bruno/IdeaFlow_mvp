import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type RootStackParamList = {
  Main: undefined;
  IdeasList: undefined;
  IdeaDetail: { ideaId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'IdeaDetail'>;

interface RecordingInfo {
  filename: string;
  filepath: string;
  title: string;
  date: string;
  size: number;
  exists: boolean;
}

export default function IdeaDetailScreen({ route, navigation }: Props) {
  const { ideaId } = route.params;
  const [recording, setRecording] = useState<RecordingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio player state
  const [audioFilePath, setAudioFilePath] = useState<string | null>(null);
  const audioPlayer = useAudioPlayer(audioFilePath || '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressIntervalRef = useRef<number | null>(null);

  const loadRecording = async () => {
    try {
      setLoading(true);
      setError(null);

      const audioDir = `${FileSystem.documentDirectory}audio/`;
      const filepath = `${audioDir}${ideaId}`;

      const fileInfo = await FileSystem.getInfoAsync(filepath);

      if (!fileInfo.exists) {
        setError('Recording file not found');
        setLoading(false);
        return;
      }

      // Extract date from filename
      let displayTitle = 'Voice Recording';
      let date = 'Unknown date';

      if (ideaId.includes('idea-recording-')) {
        const dateMatch = ideaId.match(/idea-recording-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
        if (dateMatch) {
          const dateStr = dateMatch[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
          const recordingDate = new Date(dateStr);
          displayTitle = `Idea - ${recordingDate.toLocaleDateString()}`;
          date = recordingDate.toLocaleString();
        }
      }

      setRecording({
        filename: ideaId,
        filepath,
        title: displayTitle,
        date,
        size: fileInfo.size!,
        exists: true
      });

      // Set the audio file path to trigger audio player creation
      setAudioFilePath(filepath);
      console.log('Recording loaded successfully:', filepath);

    } catch (error) {
      console.error('Error loading recording:', error);
      setError('Failed to load recording');
    } finally {
      setLoading(false);
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
    loadRecording();
  }, [ideaId]);

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

  if (error || !recording) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{error || 'Recording not found'}</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{recording.title}</Text>
        <Text style={styles.subtitle}>{recording.date}</Text>
        <Text style={styles.fileInfo}>
          File: {recording.filename} • Size: {(recording.size / 1024).toFixed(1)} KB
        </Text>

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
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
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
});