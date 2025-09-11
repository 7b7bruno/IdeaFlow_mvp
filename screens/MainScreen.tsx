import React, { useState } from 'react';
import { Text, View, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';
import { useAudioRecording } from '../hooks/useAudioRecording';
import { useTranscription } from '../hooks/useTranscription';

type RootStackParamList = {
  Main: undefined;
  IdeasList: undefined;
  IdeaDetail: { ideaId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

export default function MainScreen({ navigation }: Props) {
  const {
    recordingState,
    recordingDuration,
    error,
    isRecording,
    startRecording,
    stopRecording,
    clearError,
  } = useAudioRecording();

  const {
    transcriptionState,
    transcriptionResult,
    transcriptionError,
    isTranscribing,
    transcribeAudio,
    clearTranscription,
    clearError: clearTranscriptionError,
  } = useTranscription();

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getButtonColor = (): string => {
    if (isTranscribing) return '#8E8E93';
    
    switch (recordingState) {
      case 'recording':
        return '#FF3B30';
      case 'processing':
        return '#8E8E93';
      case 'error':
        return '#FF3B30';
      default:
        return '#007AFF';
    }
  };

  const getButtonText = (): string => {
    if (isTranscribing) return 'Transcribing...';
    
    switch (recordingState) {
      case 'recording':
        return 'Stop';
      case 'processing':
        return 'Processing...';
      case 'error':
        return 'Try Again';
      case 'complete':
        return 'Record Another';
      default:
        return 'Record Idea';
    }
  };

  const isButtonDisabled = (): boolean => {
    return recordingState === 'processing' || isTranscribing;
  };

  const handleRecordPress = async () => {
    if (error) {
      clearError();
      return;
    }

    if (transcriptionError) {
      clearTranscriptionError();
      clearTranscription();
      return;
    }

    if (isRecording) {
      try {
        const recordingUri = await stopRecording();
        if (recordingUri) {
          // Verify the file exists and get its info
          try {
            const fileInfo = await FileSystem.getInfoAsync(recordingUri);
            console.log('🎙️ Recording Details:');
            console.log('📍 File Path:', recordingUri);
            console.log('📂 File exists:', fileInfo.exists);
            console.log('📊 File size:', fileInfo.exists ? `${(fileInfo.size! / 1024).toFixed(2)} KB` : 'Unknown');
            
            const fileName = recordingUri.split('/').pop();
            const sizeInfo = fileInfo.exists ? `\nSize: ${(fileInfo.size! / 1024).toFixed(2)} KB` : '';
            
            // Start transcription automatically
            if (fileInfo.exists) {
              await transcribeAudio(recordingUri);
            }
            
            Alert.alert(
              '🎙️ Recording Complete!',
              `Your idea has been recorded successfully!\n\nFile: ${fileName}${sizeInfo}\n\nTranscription ${transcriptionState === 'completed' ? 'completed' : 'in progress'}...`,
              [
                {
                  text: 'View Details',
                  onPress: () => {
                    const transcriptionText = transcriptionResult 
                      ? `\n\nTranscription:\n"${transcriptionResult.transcription.substring(0, 200)}${transcriptionResult.transcription.length > 200 ? '...' : ''}"`
                      : '\n\nTranscription: In progress...';
                    
                    Alert.alert(
                      'Recording Details',
                      `Path: ${recordingUri}\n\nExists: ${fileInfo.exists}\nSize: ${fileInfo.exists ? `${(fileInfo.size! / 1024).toFixed(2)} KB` : 'Unknown'}${transcriptionText}`,
                      [{ text: 'OK' }]
                    );
                  }
                },
                {
                  text: 'OK',
                  style: 'default'
                }
              ]
            );
          } catch (fileError) {
            console.error('Error checking file:', fileError);
            console.log('🎙️ Recording saved at:', recordingUri);
            
            Alert.alert(
              '🎙️ Recording Complete!',
              `Your idea has been recorded!\n\nFile path logged to console.`,
              [{ text: 'OK' }]
            );
          }
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    } else {
      try {
        clearTranscription(); // Clear any previous transcription
        await startRecording();
      } catch (error) {
        console.error('Error starting recording:', error);
      }
    }
  };

  const handleViewAllPress = () => {
    navigation.navigate('IdeasList');
  };

  const listAllRecordings = async () => {
    try {
      const audioDir = `${FileSystem.documentDirectory}audio/`;
      console.log('📂 Audio Directory:', audioDir);
      
      // Check if audio directory exists
      const audioDirInfo = await FileSystem.getInfoAsync(audioDir);
      if (!audioDirInfo.exists) {
        Alert.alert(
          'No Recordings Found',
          `Audio directory doesn't exist yet.\nRecord your first idea to create it!`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      const files = await FileSystem.readDirectoryAsync(audioDir);
      const audioFiles = files.filter(file => 
        (file.includes('idea-recording') || file.endsWith('.m4a') || file.endsWith('.mp4') || file.endsWith('.wav')) &&
        (file.endsWith('.m4a') || file.endsWith('.mp4') || file.endsWith('.wav'))
      );
      
      console.log('🎙️ Found', audioFiles.length, 'audio recordings:');
      
      if (audioFiles.length === 0) {
        Alert.alert(
          'No Recordings Found',
          `No audio files found in:\n${audioDir}`,
          [{ text: 'OK' }]
        );
        return;
      }

      for (const file of audioFiles) {
        const filePath = `${audioDir}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        console.log(`📄 ${file}: ${fileInfo.exists ? `${(fileInfo.size! / 1024).toFixed(2)} KB` : 'Not found'}`);
      }

      Alert.alert(
        '🎙️ Recordings Found',
        `Found ${audioFiles.length} recordings:\n\n${audioFiles.join('\n')}\n\nCheck console for full details and file sizes.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error listing recordings:', error);
      Alert.alert('Error', 'Could not list recordings. Check console for details.', [{ text: 'OK' }]);
    }
  };

  // Show error alerts when errors occur
  React.useEffect(() => {
    if (error) {
      Alert.alert(
        'Recording Error',
        error.message,
        [
          {
            text: 'OK',
            onPress: clearError,
          }
        ]
      );
    }
  }, [error]);

  React.useEffect(() => {
    if (transcriptionError) {
      Alert.alert(
        'Transcription Error',
        transcriptionError.message,
        [
          {
            text: 'Retry',
            onPress: clearTranscriptionError,
            style: 'default'
          },
          {
            text: 'OK',
            onPress: () => {
              clearTranscriptionError();
              clearTranscription();
            },
            style: 'cancel'
          }
        ]
      );
    }
  }, [transcriptionError]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>IdeaFlow</Text>
        
        <View style={styles.recordContainer}>
          {isRecording && (
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>
                {formatDuration(recordingDuration)}
              </Text>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>Recording...</Text>
              </View>
            </View>
          )}

          {isTranscribing && (
            <View style={styles.timerContainer}>
              <View style={styles.transcribingIndicator}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.transcribingText}>Transcribing your idea...</Text>
              </View>
            </View>
          )}
          
          <TouchableOpacity 
            style={[
              styles.recordButton, 
              { backgroundColor: getButtonColor() },
              isButtonDisabled() && styles.disabledButton
            ]}
            onPress={handleRecordPress}
            activeOpacity={isButtonDisabled() ? 1 : 0.8}
            disabled={isButtonDisabled()}
          >
            {(recordingState === 'processing' || isTranscribing) ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.recordButtonText}>{getButtonText()}</Text>
              </View>
            ) : (
              <Text style={styles.recordButtonText}>
                {getButtonText()}
              </Text>
            )}
          </TouchableOpacity>

          {recordingState === 'complete' && !isTranscribing && (
            <View style={styles.completeContainer}>
              <Text style={styles.completeText}>✓ Recording saved successfully!</Text>
            </View>
          )}

          {transcriptionState === 'completed' && transcriptionResult && (
            <View style={styles.transcriptionContainer}>
              <Text style={styles.transcriptionTitle}>✨ Transcription Complete!</Text>
              <ScrollView style={styles.transcriptionScroll} nestedScrollEnabled={true}>
                <Text style={styles.transcriptionText}>
                  "{transcriptionResult.transcription}"
                </Text>
              </ScrollView>
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={[
            styles.viewAllButton,
            isRecording && styles.disabledViewAllButton
          ]}
          onPress={handleViewAllPress}
          onLongPress={listAllRecordings}
          activeOpacity={isRecording ? 1 : 0.7}
          disabled={isRecording}
        >
          <Text style={[
            styles.viewAllButtonText,
            isRecording && styles.disabledViewAllButtonText
          ]}>
            View All Ideas
          </Text>
          <Text style={styles.longPressHint}>
            (Long press to list recordings)
          </Text>
        </TouchableOpacity>
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
    flexGrow: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  recordContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.7,
  },
  processingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 4,
  },
  completeContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#D4EEDA',
    borderRadius: 20,
  },
  completeText: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  viewAllButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  disabledViewAllButton: {
    backgroundColor: '#E5E5EA',
    shadowOpacity: 0,
    elevation: 0,
  },
  viewAllButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledViewAllButtonText: {
    color: '#8E8E93',
  },
  longPressHint: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
    marginTop: 2,
  },
  transcribingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcribingText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  transcriptionContainer: {
    marginTop: 20,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 350,
  },
  transcriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  transcriptionScroll: {
    maxHeight: 150,
  },
  transcriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
    fontStyle: 'italic',
  },
});