import React, { useState } from 'react';
import { Text, View, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { File } from 'expo-file-system';
import { getAllIdeas, cleanupOrphanedIdeas, type Idea } from '../services/database';
import { theme } from '../constants/theme';

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
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.cleanupButton} onPress={handleCleanup}>
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
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={loadIdeas}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  );
}

const { colors, radius, font } = theme;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cleanupButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cleanupButtonText: {
    color: colors.textMuted,
    fontSize: font.small,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  ideaItem: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ideaTitle: {
    fontSize: font.label,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 5,
  },
  ideaPreview: {
    fontSize: font.small,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: 6,
  },
  ideaDate: {
    fontSize: font.tiny,
    color: colors.textDim,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: font.title,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: font.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  backButtonText: {
    color: colors.accent,
    fontSize: font.body,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: font.body,
    color: colors.textDim,
    letterSpacing: 1,
  },
});