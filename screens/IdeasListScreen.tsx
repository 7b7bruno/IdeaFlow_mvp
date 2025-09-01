import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';

type RootStackParamList = {
  Main: undefined;
  IdeasList: undefined;
  IdeaDetail: { ideaId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'IdeasList'>;

interface Recording {
  id: string;
  filename: string;
  filepath: string;
  title: string;
  preview: string;
  size: number;
  date: string;
}

export default function IdeasListScreen({ navigation }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecordings = async () => {
    try {
      const audioDir = `${FileSystem.documentDirectory}audio/`;
      const audioDirInfo = await FileSystem.getInfoAsync(audioDir);
      
      if (!audioDirInfo.exists) {
        setRecordings([]);
        setLoading(false);
        return;
      }

      const files = await FileSystem.readDirectoryAsync(audioDir);
      const audioFiles = files.filter(file => 
        (file.includes('idea-recording') || file.endsWith('.m4a') || file.endsWith('.mp4') || file.endsWith('.wav')) &&
        (file.endsWith('.m4a') || file.endsWith('.mp4') || file.endsWith('.wav'))
      );

      const recordingsData: Recording[] = [];
      
      for (const file of audioFiles) {
        const filePath = `${audioDir}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        if (fileInfo.exists) {
          // Extract date from filename if it follows the pattern
          let displayTitle = 'Voice Recording';
          let date = 'Unknown date';
          
          if (file.includes('idea-recording-')) {
            const dateMatch = file.match(/idea-recording-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
            if (dateMatch) {
              const dateStr = dateMatch[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
              const recordingDate = new Date(dateStr);
              displayTitle = `Idea - ${recordingDate.toLocaleDateString()}`;
              date = recordingDate.toLocaleString();
            }
          }
          
          recordingsData.push({
            id: file,
            filename: file,
            filepath: filePath,
            title: displayTitle,
            preview: `Recorded on ${date} • ${(fileInfo.size! / 1024).toFixed(1)} KB`,
            size: fileInfo.size!,
            date: date
          });
        }
      }
      
      // Sort by date (most recent first)
      recordingsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setRecordings(recordingsData);
    } catch (error) {
      console.error('Error loading recordings:', error);
      Alert.alert('Error', 'Could not load recordings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecordings();
  }, []);

  const renderIdea = ({ item }: { item: Recording }) => (
    <TouchableOpacity
      style={styles.ideaItem}
      onPress={() => navigation.navigate('IdeaDetail', { ideaId: item.id })}
    >
      <Text style={styles.ideaTitle}>{item.title}</Text>
      <Text style={styles.ideaPreview}>{item.preview}</Text>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No Ideas Yet</Text>
      <Text style={styles.emptyMessage}>
        Record your first idea on the main screen to see it here!
      </Text>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>Go Back to Record</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Your Ideas</Text>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading recordings...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Your Ideas</Text>
        {recordings.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={recordings}
            renderItem={renderIdea}
            keyExtractor={(item) => item.id}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            onRefresh={loadRecordings}
            refreshing={loading}
          />
        )}
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
    marginBottom: 20,
  },
  list: {
    flex: 1,
  },
  ideaItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  ideaTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 6,
  },
  ideaPreview: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
});