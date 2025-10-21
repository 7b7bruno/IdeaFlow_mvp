import { useState, useCallback } from 'react';
import titleGenerationService, { TitleGenerationResult, TitleGenerationError, TitleGenerationOptions } from '../services/titleGenerationService';

export type TitleGenerationState = 'idle' | 'generating' | 'completed' | 'error';

export interface TitleGenerationHook {
  titleGenerationState: TitleGenerationState;
  titleResult: TitleGenerationResult | null;
  titleError: TitleGenerationError | null;
  isGenerating: boolean;
  generateTitle: (transcription: string, options?: TitleGenerationOptions) => Promise<TitleGenerationResult | null>;
  clearTitle: () => void;
  clearError: () => void;
  isServiceAvailable: () => Promise<boolean>;
}

export const useTitleGeneration = (): TitleGenerationHook => {
  const [titleGenerationState, setTitleGenerationState] = useState<TitleGenerationState>('idle');
  const [titleResult, setTitleResult] = useState<TitleGenerationResult | null>(null);
  const [titleError, setTitleError] = useState<TitleGenerationError | null>(null);

  const generateTitle = useCallback(async (transcription: string, options?: TitleGenerationOptions): Promise<TitleGenerationResult | null> => {
    try {
      setTitleGenerationState('generating');
      setTitleError(null);
      setTitleResult(null);

      const result = await titleGenerationService.generateTitle(transcription, options);

      setTitleResult(result);
      setTitleGenerationState('completed');
      return result;
    } catch (error) {
      console.error('Title generation failed:', error);
      setTitleError(error as TitleGenerationError);
      setTitleGenerationState('error');
      // Don't throw - we want to handle errors gracefully
      return null;
    }
  }, []);

  const clearTitle = useCallback(() => {
    setTitleResult(null);
    setTitleError(null);
    setTitleGenerationState('idle');
  }, []);

  const clearError = useCallback(() => {
    setTitleError(null);
    if (titleGenerationState === 'error') {
      setTitleGenerationState('idle');
    }
  }, [titleGenerationState]);

  const isServiceAvailable = useCallback(async (): Promise<boolean> => {
    return await titleGenerationService.isServiceAvailable();
  }, []);

  return {
    titleGenerationState,
    titleResult,
    titleError,
    isGenerating: titleGenerationState === 'generating',
    generateTitle,
    clearTitle,
    clearError,
    isServiceAvailable,
  };
};
