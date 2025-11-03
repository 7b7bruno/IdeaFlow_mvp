# IdeaFlow

Voice-powered idea capture with AI transcription and title generation.

## Overview

IdeaFlow is a mobile app for capturing spontaneous ideas through voice recording. It uses AI to transcribe your voice notes and automatically generate descriptive titles, making it easy to capture and organize thoughts on the go.

## Core Features

- **Voice Recording**: One-tap recording with auto-stop detection
- **AI Transcription**: Converts speech to clean, readable text using Google Gemini 2.0 Flash
- **Smart Titles**: Automatically generates concise titles (3-6 words) for each idea
- **Local Storage**: All data stored securely on device using SQLite
- **Editable Titles**: Tap any title to rename your ideas

## Tech Stack

### Framework & Platform
- **Expo SDK 54** with React Native 0.81.4
- **React 19.1.0** - UI library
- **TypeScript** - Type safety
- **Expo Router** - File-based navigation

### Key Dependencies
- `expo-audio` - Voice recording
- `expo-sqlite` - Local database
- `expo-file-system` - File management
- `@google/genai` - Google Gemini AI for transcription and title generation
- `@react-navigation/native` - Navigation components
- `expo-haptics` - Tactile feedback
- `expo-image` - Optimized image handling

### Architecture

```
app/                    # Expo Router pages
├── index.tsx          # Main screen
└── _layout.tsx        # App layout

screens/               # Screen components
├── MainScreen.tsx     # Recording interface
├── IdeasListScreen.tsx # Ideas list view
└── IdeaDetailScreen.tsx # Individual idea view

services/              # Business logic
├── transcriptionService.ts  # Gemini transcription
├── titleGenerationService.ts # Gemini title generation
└── database.ts        # SQLite operations

hooks/                 # Custom hooks
├── useAudioRecording.ts
├── useTranscription.ts
└── useTitleGeneration.ts

config/
└── prompts.js         # AI prompts for transcription & titles
```

### Database Schema

```sql
CREATE TABLE ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  audioPath TEXT NOT NULL,
  transcription TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

## Getting Started

### Prerequisites
- Node.js 18+
- Google Gemini API key ([Get one here](https://ai.google.dev/))

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd IdeaFlow_mvp

# Install dependencies
npm install

# Create .env file
echo "EXPO_PUBLIC_GEMINI_API_KEY=your_api_key_here" > .env

# Start development server
npm start
```

### Running on Device

```bash
# iOS simulator
npm run ios

# Android emulator
npm run android

# Expo Go (scan QR code)
npm start
```

## Development

### Project Structure

The app uses Expo Router for file-based routing and follows a service-based architecture:

- **Services**: Handle AI transcription, title generation, and database operations
- **Hooks**: Provide reusable state management for recording, transcription, and title generation
- **Screens**: Implement the UI for recording, viewing, and managing ideas

### Key Services

**TranscriptionService** (`services/transcriptionService.ts`)
- Uses Gemini 2.0 Flash for audio transcription
- Includes retry logic with exponential backoff
- Validates audio files and handles errors gracefully

**TitleGenerationService** (`services/titleGenerationService.ts`)
- Generates 3-6 word titles from transcriptions
- Uses custom prompts to ensure consistency

**Database** (`services/database.ts`)
- SQLite with WAL mode for better performance
- Supports CRUD operations and search
- Includes cleanup utilities for orphaned records

## License

MIT License - Copyright (c) 2025 Bruno Brauns