import { AudioModule, RecordingPresets, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export type RecordingState = 'idle' | 'recording' | 'processing' | 'complete' | 'error';

export interface RecordingError {
  type: 'permission' | 'storage' | 'recording' | 'duration' | 'interruption' | 'device';
  message: string;
}

export interface AudioRecordingHook {
  recordingState: RecordingState;
  recordingDuration: number;
  error: RecordingError | null;
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  clearError: () => void;
  cleanup: () => Promise<void>;
}

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 128000,
};

const MAX_RECORDING_DURATION = 5 * 60 * 1000; // 5 minutes
const MIN_RECORDING_DURATION = 3 * 1000; // 3 seconds
const SILENCE_TIMEOUT = 5 * 1000; // 5 seconds of silence

// Temporary flag to bypass storage check for testing
const BYPASS_STORAGE_CHECK = true;

export const useAudioRecording = (): AudioRecordingHook => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<RecordingError | null>(null);

  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(audioRecorder);

  const durationTimerRef = useRef<number | null>(null);
  const maxDurationTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const clearTimers = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const generateUniqueFilename = (): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomSuffix = Math.random().toString(36).substring(7);
    return `idea-recording-${timestamp}-${randomSuffix}.m4a`;
  };

  const checkStorageSpace = async (): Promise<boolean> => {
    // Temporary bypass for testing
    if (BYPASS_STORAGE_CHECK) {
      console.log('Storage check bypassed for testing');
      return true;
    }

    try {
      const availableSpace = await FileSystem.getFreeDiskStorageAsync();
      // A 5-minute recording at high quality is roughly 5-10MB
      // We'll require only 5MB to be very permissive
      const requiredSpace = 5 * 1024 * 1024; // 5MB minimum
      const hasEnoughSpace = availableSpace > requiredSpace;

      console.log(`Storage check - Available: ${(availableSpace / 1024 / 1024).toFixed(2)}MB, Required: ${(requiredSpace / 1024 / 1024).toFixed(2)}MB, Pass: ${hasEnoughSpace}`);

      // For now, let's be very permissive - only block if less than 5MB available
      return hasEnoughSpace;
    } catch (error) {
      console.warn('Storage space check failed:', error);
      // Always return true if we can't check - don't block the user
      console.log('Storage check bypassed due to error - allowing recording');
      return true;
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status } = await AudioModule.requestRecordingPermissionsAsync();

      if (status !== 'granted') {
        setError({
          type: 'permission',
          message: 'Microphone permission is required to record ideas. Please enable it in your device settings.',
        });
        return false;
      }

      return true;
    } catch (error) {
      setError({
        type: 'permission',
        message: 'Failed to request microphone permission. Please check your device settings.',
      });
      return false;
    }
  };

  // expo-audio handles audio mode automatically

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
      // App is going to background while recording
      if (recorderState.isRecording) {
        console.log('App backgrounded during recording, continuing...');
        // Keep recording in background
      }
    }
    appStateRef.current = nextAppState;
  };

  const startDurationTimer = () => {
    startTimeRef.current = Date.now();
    durationTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setRecordingDuration(elapsed);
    }, 100);
  };

  const startMaxDurationTimer = () => {
    maxDurationTimerRef.current = setTimeout(async () => {
      console.log('Max recording duration reached, stopping...');
      await stopRecording();
    }, MAX_RECORDING_DURATION);
  };

  const monitorSilence = async () => {
    // Note: expo-av doesn't provide real-time audio level monitoring
    // This is a placeholder for future implementation with a more advanced audio library
    // For now, we'll skip the silence detection
    console.log('Silence monitoring not implemented with expo-av');
  };

  const startRecording = async (): Promise<void> => {
    try {
      setError(null);
      setRecordingState('processing');

      // Check permissions
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setRecordingState('error');
        return;
      }

      // Check storage space
      const hasStorage = await checkStorageSpace();
      if (!hasStorage) {
        setError({
          type: 'storage',
          message: 'Insufficient storage space. Please free up some space and try again.',
        });
        setRecordingState('error');
        return;
      }

      // Ensure audio directory exists
      const audioDir = `${FileSystem.documentDirectory}audio/`;
      const audioDirInfo = await FileSystem.getInfoAsync(audioDir);
      if (!audioDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
        console.log('Created audio directory:', audioDir);
      }

      // Prepare and start recording
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setRecordingState('recording');
      setRecordingDuration(0);

      // Start timers
      startDurationTimer();
      startMaxDurationTimer();
      monitorSilence();

      console.log('Recording started successfully');

    } catch (error: any) {
      console.error('Failed to start recording:', error);
      setError({
        type: 'recording',
        message: 'Failed to start recording. Please check your microphone and try again.',
      });
      setRecordingState('error');
      await cleanup();
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    try {
      setRecordingState('processing');
      clearTimers();

      if (!recorderState.isRecording) {
        setError({
          type: 'recording',
          message: 'No active recording found.',
        });
        setRecordingState('error');
        return null;
      }

      // Check minimum duration
      const duration = Date.now() - startTimeRef.current;
      if (duration < MIN_RECORDING_DURATION) {
        setError({
          type: 'duration',
          message: `Recording must be at least ${MIN_RECORDING_DURATION / 1000} seconds long.`,
        });
        setRecordingState('error');
        await cleanup();
        return null;
      }

      // Stop recording and get URI
      await audioRecorder.stop();
      const tempUri = audioRecorder.uri;

      if (tempUri) {
        // Move file from cache to our audio directory
        const filename = generateUniqueFilename();
        const audioDir = `${FileSystem.documentDirectory}audio/`;
        const finalUri = `${audioDir}${filename}`;

        try {
          await FileSystem.copyAsync({
            from: tempUri,
            to: finalUri
          });

          // Clean up temporary file
          try {
            await FileSystem.deleteAsync(tempUri);
          } catch (deleteError) {
            console.warn('Could not delete temporary file:', deleteError);
          }

          setRecordingState('complete');
          console.log('Recording completed and moved to:', finalUri);
          return finalUri;

        } catch (moveError) {
          console.error('Failed to move recording file:', moveError);
          setRecordingState('complete');
          console.log('Recording completed (temp location):', tempUri);
          return tempUri;
        }
      }

      setRecordingState('complete');
      return null;

    } catch (error: any) {
      console.error('Failed to stop recording:', error);
      setError({
        type: 'recording',
        message: 'Failed to stop recording. The recording may be corrupted.',
      });
      setRecordingState('error');
      await cleanup();
      return null;
    }
  };

  const clearError = () => {
    setError(null);
    if (recordingState === 'error') {
      setRecordingState('idle');
    }
  };

  const cleanup = async (): Promise<void> => {
    try {
      clearTimers();

      if (recorderState.isRecording) {
        await audioRecorder.stop();
      }

      setRecordingDuration(0);

      if (recordingState !== 'complete') {
        setRecordingState('idle');
      }

      // expo-audio handles audio mode cleanup automatically

    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  };

  // Setup app state listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    recordingState,
    recordingDuration,
    error,
    isRecording: recorderState.isRecording,
    startRecording,
    stopRecording,
    clearError,
    cleanup,
  };
};