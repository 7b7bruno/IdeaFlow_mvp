import React, { useState } from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function Index() {
  const [isRecording, setIsRecording] = useState(false);

  const handleRecordPress = () => {
    setIsRecording(!isRecording);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topBar}>
          <Text style={styles.title}>IdeaFlow</Text>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Text style={styles.settingsLink}>Settings</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recordContainer}>
          <TouchableOpacity
            style={[
              styles.recordButton,
              { backgroundColor: isRecording ? '#FF3B30' : '#007AFF' }
            ]}
            onPress={handleRecordPress}
            activeOpacity={0.8}
          >
            <Text style={styles.recordButtonText}>
              {isRecording ? 'Stop' : 'Record Idea'}
            </Text>
          </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  settingsLink: {
    fontSize: 16,
    color: '#007AFF',
  },
  recordContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
