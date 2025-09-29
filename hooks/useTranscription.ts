import { useState, useCallback } from 'react';
import transcriptionService, { TranscriptionResult, TranscriptionError, TranscriptionOptions } from '../services/transcriptionService';

export type TranscriptionState = 'idle' | 'transcribing' | 'completed' | 'error';

export interface TranscriptionHook {
  transcriptionState: TranscriptionState;
  transcriptionResult: TranscriptionResult | null;
  transcriptionError: TranscriptionError | null;
  isTranscribing: boolean;
  transcribeAudio: (filePath: string, options?: TranscriptionOptions) => Promise<TranscriptionResult | null>;
  clearTranscription: () => void;
  clearError: () => void;
  isServiceAvailable: () => Promise<boolean>;
  testConnection: () => Promise<boolean>;
}

export const useTranscription = (): TranscriptionHook => {
  const [transcriptionState, setTranscriptionState] = useState<TranscriptionState>('idle');
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<TranscriptionError | null>(null);

  const transcribeAudio = useCallback(async (filePath: string, options?: TranscriptionOptions): Promise<TranscriptionResult | null> => {
    try {
      setTranscriptionState('transcribing');
      setTranscriptionError(null);
      setTranscriptionResult(null);

      const result = await transcriptionService.transcribeAudio(filePath, options);

      setTranscriptionResult(result);
      setTranscriptionState('completed');
      return result;
    } catch (error) {
      console.error('Transcription failed:', error);
      setTranscriptionError(error as TranscriptionError);
      setTranscriptionState('error');
      throw error;
    }
  }, []);

  const clearTranscription = useCallback(() => {
    setTranscriptionResult(null);
    setTranscriptionError(null);
    setTranscriptionState('idle');
  }, []);

  const clearError = useCallback(() => {
    setTranscriptionError(null);
    if (transcriptionState === 'error') {
      setTranscriptionState('idle');
    }
  }, [transcriptionState]);

  const isServiceAvailable = useCallback(async (): Promise<boolean> => {
    return await transcriptionService.isServiceAvailable();
  }, []);

  const testConnection = useCallback(async (): Promise<boolean> => {
    return await transcriptionService.testConnection();
  }, []);

  return {
    transcriptionState,
    transcriptionResult,
    transcriptionError,
    isTranscribing: transcriptionState === 'transcribing',
    transcribeAudio,
    clearTranscription,
    clearError,
    isServiceAvailable,
    testConnection,
  };
};