# NeuroNotes Mobile

React Native + Expo app for NeuroNotes. Mirrors the full web feature set on iOS and Android.

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- [Expo Go](https://expo.dev/go) app on your device (for development)
- EAS CLI (for production builds): `npm install -g eas-cli`

## Quick Start

```bash
cd mobile
npm install
cp .env.example .env
# Fill in your values in .env
npm start
```

Scan the QR code with the Expo Go app on your phone.

## Environment Variables

Create a `.env` file (copy from `.env.example`):

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | FastAPI backend URL (e.g. `http://192.168.1.x:8001`) |
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

For device testing, use your machine's local IP instead of `localhost`.

## Running on a Simulator

```bash
# iOS simulator (macOS only)
npm run ios

# Android emulator
npm run android
```

## Production Builds with EAS

1. Log in: `eas login`
2. Configure: `eas build:configure`
3. Build:

```bash
# Android APK/AAB
npm run build:android

# iOS IPA
npm run build:ios
```

## App Structure

```
app/
  _layout.tsx          Root layout with auth guard
  (auth)/index.tsx     Magic link sign-in
  (tabs)/
    _layout.tsx        Bottom tab bar
    index.tsx          Notes list
    search.tsx         Semantic search
    chat.tsx           AI Chat
    graph.tsx          Knowledge graph
    more.tsx           Feature grid
  note/[id].tsx        Note editor
components/
  NoteCard.tsx         Note list item
  NoteEditor.tsx       Text editor
  VoiceRecorder.tsx    Audio recording
  FlashcardStudy.tsx   SM-2 flashcard study
  TagChip.tsx          Tag display
  AISuggestionBar.tsx  Writing coach banner
lib/
  api.ts               FastAPI client
  supabase.ts          Supabase RN client
  sm2.ts               SM-2 algorithm
hooks/
  useAuth.ts           Auth state
  useNotes.ts          Notes CRUD
  useAI.ts             AI feature hooks
constants/
  theme.ts             Design tokens
```

## Notes

- The graph screen uses a JavaScript force-directed layout — not a full ReactFlow port, but functional for visualising note connections.
- Voice notes require microphone permission and the backend `/ai/voice` endpoint (Gemini Audio).
- All API calls target `EXPO_PUBLIC_API_URL`. When testing on a physical device, this must be your machine's local network IP, not `localhost`.
