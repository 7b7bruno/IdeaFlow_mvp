import React, { useState } from 'react';
import { Text, View, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { File } from 'expo-file-system';
import { getAllIdeas, cleanupOrphanedIdeas, type Idea } from '../services/database';

type RootStackParamList = {
  Main: undefined;
  IdeasList: undefined;
  IdeaDetail: { ideaId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'IdeasList'>;

interface IdeaListItem extends Idea {
  preview: string;
  dateFormatted: string;
}

export default function IdeasListScreen({ navigation }: Props) {
  const [ideas, setIdeas] = useState<IdeaListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadIdeas = async () => {
    try {
      setLoading(true);
      const allIdeas = await getAllIdeas();

      // Format ideas for display
      const formattedIdeas: IdeaListItem[] = await Promise.all(
        allIdeas.map(async (idea) => {
          const recordedDate = new Date(idea.createdAt);
          const dateFormatted = recordedDate.toLocaleString();

          // Get file size if available
          let fileSize = 0;
          try {
            const file = new File(idea.audioPath);
            if (file.exists) {
              fileSize = file.size;
            }
          } catch (err) {
            console.warn('Could not get file size for:', idea.audioPath);
          }

          const transcriptionPreview = idea.transcription
            ? idea.transcription.substring(0, 100) + (idea.transcription.length > 100 ? '...' : '')
            : 'No transcription';

          return {
            ...idea,
            preview: `${transcriptionPreview} • ${(fileSize / 1024).toFixed(1)} KB`,
            dateFormatted,
          };
        })
      );

      setIdeas(formattedIdeas);
    } catch (error) {
      console.error('Error loading ideas:', error);
      Alert.alert('Error', 'Could not load ideas from database');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadIdeas();
    }, [])
  );

  const handleCleanup = async () => {
    Alert.alert(
      'Clean Up Database',
      'This will remove ideas with missing audio files. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Clean Up',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletedCount = await cleanupOrphanedIdeas();
              Alert.alert(
                'Cleanup Complete',
                `Removed ${deletedCount} orphaned idea${deletedCount !== 1 ? 's' : ''}.`,
                [{ text: 'OK', onPress: loadIdeas }]
              );
            } catch (error) {
              console.error('Error cleaning up database:', error);
              Alert.alert('Error', 'Failed to clean up database');
            }
          }
        }
      ]
    );
  };

  const renderIdea = ({ item }: { item: IdeaListItem }) => (
    <TouchableOpacity
      style={styles.ideaItem}
      onPress={() => navigation.navigate('IdeaDetail', { ideaId: String(item.id) })}
    >
      <Text style={styles.ideaTitle}>{item.title}</Text>
      <Text style={styles.ideaPreview}>{item.preview}</Text>
      <Text style={styles.ideaDate}>{item.dateFormatted}</Text>
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
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Your Ideas</Text>
            <TouchableOpacity
              style={styles.cleanupButton}
              onPress={handleCleanup}
            >
              <Text style={styles.cleanupButtonText}>Clean Up</Text>
            </TouchableOpacity>
          </View>
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
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Your Ideas</Text>
          <TouchableOpacity
            style={styles.cleanupButton}
            onPress={handleCleanup}
          >
            <Text style={styles.cleanupButtonText}>Clean Up</Text>
          </TouchableOpacity>
        </View>
        {ideas.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={ideas}
            renderItem={renderIdea}
            keyExtractor={(item) => String(item.id)}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            onRefresh={loadIdeas}
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  cleanupButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cleanupButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
    marginBottom: 4,
  },
  ideaDate: {
    fontSize: 12,
    color: '#999',
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