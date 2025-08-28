# IdeaFlow
> Voice-powered idea capture with AI expansion

## Project Overview

IdeaFlow is a mobile app that captures spontaneous ideas through voice recording and uses AI to transcribe and expand upon those ideas. Perfect for capturing thoughts while driving, walking, or any time you can't type but have a brilliant idea.

### Core Problem
- You get your best ideas at inconvenient times (driving, exercising, cooking)
- Voice memos pile up and never get revisited
- Ideas get lost or forgotten without proper development
- Taking notes while driving is unsafe

### Solution
A voice-first app that:
1. **Captures ideas instantly** with one-tap recording
2. **Transcribes automatically** using AI speech-to-text
3. **Expands intelligently** with AI-generated related concepts and insights
4. **Organizes simply** with automatic categorization

---

## MVP Features (Version 1.0)

### ✅ Core Features
- **Voice Recording**: One-tap recording with auto-stop detection
- **AI Transcription**: Convert speech to text using OpenAI Whisper
- **AI Expansion**: Generate related ideas and insights using GPT-4
- **Simple Organization**: Chronological list with basic categories
- **Local Storage**: All data stored on device (no cloud dependency)

### ❌ Not in MVP
- Cloud sync
- Collaboration features
- Advanced categorization
- Export/sharing
- Web/desktop versions
- Voice commands beyond recording

---

## Technical Architecture

### Platform
- **Framework**: Expo + React Native (cross-platform)
- **Target**: iOS first, Android second
- **Minimum iOS**: 14.0+ (iPhone 8+)
- **Expo SDK**: 50+

### Key Dependencies
```
expo-av                             # Voice recording (Expo managed)
@react-navigation/native            # Screen navigation  
@expo/vector-icons                  # UI icons (Expo managed)
axios                              # API calls
expo-sqlite                        # Local database (Expo managed)
expo-permissions                   # Microphone permissions
```

### APIs & Services
- **Speech-to-Text**: OpenAI Whisper API
- **AI Expansion**: OpenAI GPT-4o-mini
- **Storage**: SQLite (local only)

### Data Flow
```
Voice Input → Recording → Whisper API → Transcription → GPT-4 → AI Expansion → SQLite → UI
```

---

## User Experience

### Primary User Flow
1. Open app → Large "Record Idea" button visible
2. Tap button → Start speaking your idea
3. Auto-stop or manual stop → "Processing..." indicator
4. View result → Transcription + AI expansion + category
5. Save automatically → Return to main screen

### Target Metrics
- **Recording to result**: < 15 seconds total
- **Transcription accuracy**: > 90% for clear speech
- **Session duration**: 2-5 minutes average
- **Usage frequency**: 3+ ideas recorded per week

---

## App Structure

### Screens
```
MainScreen/
├── RecordButton (120x120dp circular)
├── RecentIdeas (last 3 ideas preview)
└── ViewAll button

IdeaDetailScreen/
├── OriginalTranscription
├── AIExpansion  
├── PlayAudio button
└── Share/Edit options

IdeasListScreen/
├── CategoryTabs (All, Business, Personal, Other)
├── SearchBar
└── IdeaCards (chronological)
```

### Database Schema
```sql
CREATE TABLE ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    original_audio_path TEXT,
    transcription TEXT,
    ai_expansion TEXT,
    category TEXT DEFAULT 'Other',
    recording_duration INTEGER,
    is_archived BOOLEAN DEFAULT FALSE
);
```

---

## Development Roadmap

### Phase 1: MVP (8 weeks)
- **Week 1-2**: Core recording functionality
- **Week 3-4**: AI integration (Whisper + GPT-4)  
- **Week 5-6**: Data storage and organization UI
- **Week 7-8**: Polish, testing, and optimization

### Phase 2: Enhancement (Future)
- Cloud sync across devices
- Smart reminders and notifications
- Export/sharing capabilities
- Advanced search and filtering
- Custom categories

---

## AI Integration Details

### Audio Recording (expo-av)
```javascript
import { Audio } from 'expo-av';

// Request permissions
const { granted } = await Audio.requestPermissionsAsync();

// Start recording
const { recording } = await Audio.Recording.createAsync(
  Audio.RecordingOptionsPresets.HIGH_QUALITY
);
```

### Idea Expansion (GPT-4o-mini)
```javascript
// Prompt template for consistent AI expansion
const prompt = `You are an idea development assistant. A user recorded: "${transcription}"

Provide:
1. Brief summary of core concept (1-2 sentences)
2. 3-5 related ideas or extensions  
3. Key implementation considerations
4. Potential challenges/opportunities

Keep response concise but insightful.`;
```

### Categorization Logic
```javascript
// Simple keyword-based auto-categorization
const categories = {
  'Business': ['app', 'startup', 'business', 'money', 'market'],
  'Personal': ['learn', 'fitness', 'health', 'family', 'goal'],
  'Creative': ['write', 'story', 'art', 'design', 'music'],
  'Technical': ['code', 'programming', 'software', 'algorithm']
};
```

---

## Competitive Context

### Direct Competitors
- **IdeaShell**: General voice idea capture with AI
- **VoiceNotes**: Popular voice transcription with basic AI
- **Noeji**: Recent voice-first idea capture app

### Differentiation Strategy
- **Hands-free optimization**: Built specifically for mobile/driving scenarios
- **Implementation focus**: AI helps you act on ideas, not just capture them
- **Simplicity**: Do 3 things exceptionally well vs. many things poorly
- **Safety-first**: Designed for use while driving/walking

---

## Success Metrics & Validation

### Technical KPIs
- Recording success rate: >95%
- Transcription accuracy: >90%
- API response time: <15 seconds
- App crash rate: <1%

### User KPIs  
- Ideas recorded per user per week: 3+
- Idea review rate: 60%+ (users read AI expansions)
- 7-day retention: 70%+
- Session frequency: 4+ times per week

### Key Questions to Validate
1. Do users prefer voice input over typing for idea capture?
2. Are AI expansions valuable or just novelty?
3. How often do users review captured ideas?
4. What's the optimal AI expansion length?

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g @expo/cli`)
- Expo Go app on your phone (for testing)
- For production: Xcode (iOS) / Android Studio (Android)

### Installation
```bash
# Create Expo project
npx create-expo-app IdeaFlow --template

# Navigate to project
cd IdeaFlow

# Install dependencies
npx expo install expo-av @react-navigation/native @expo/vector-icons expo-sqlite axios

# Start development server
npx expo start
```

### Development Workflow
```bash
# Start development server
npx expo start

# Scan QR code with Expo Go app to test on device
# Or press 'i' for iOS simulator, 'a' for Android emulator
```

### Environment Variables
Create `.env` file:
```
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
```

### Expo Configuration
Update `app.json`:
```json
{
  "expo": {
    "name": "IdeaFlow",
    "slug": "ideaflow",
    "platforms": ["ios", "android"],
    "permissions": ["RECORD_AUDIO"],
    "ios": {
      "infoPlist": {
        "NSMicrophoneUsageDescription": "This app needs microphone access to record your ideas"
      }
    },
    "android": {
      "permissions": ["RECORD_AUDIO"]
    }
  }
}
```

---

## Project Principles

### Development Philosophy
- **Ship fast, iterate faster**: Get core value working quickly
- **Expo-managed workflow**: Leverage Expo's managed services when possible
- **Local-first**: Everything works without internet when possible  
- **Privacy-focused**: User data stays on device
- **Accessibility**: Voice-first is inherently accessible
- **Battery conscious**: Optimize for mobile usage patterns

### Quality Standards
- Code coverage >80%
- All user-facing text is clear and typo-free
- Smooth 60fps animations
- Works reliably in car/noisy environments
- Graceful handling of API failures

---

## Contributing

### Code Style
- ESLint + Prettier configuration included
- TypeScript preferred for new files
- Clear, descriptive variable names
- Comment complex audio/AI logic

### Testing Strategy
- Unit tests for business logic
- Integration tests for API calls
- Manual testing on real devices (not simulator)
- Test in actual use environments (car, walking, etc.)

---

## License

MIT License - See LICENSE file for details

---

**Built with ❤️ for capturing ideas on the go**