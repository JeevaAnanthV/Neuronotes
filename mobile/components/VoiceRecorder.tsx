import { useState, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Mic, MicOff } from 'lucide-react-native';
import { aiApi } from '@/lib/api';
import { colors, radius } from '@/constants/theme';

interface VoiceRecorderProps {
  onNoteCreated: (title: string, content: string) => void;
}

export function VoiceRecorder({ onNoteCreated }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Microphone access is needed to record voice notes.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      recordingRef.current = recording;
      setRecording(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (err) {
      Alert.alert('Recording error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    setRecording(false);
    setProcessing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        Alert.alert('Error', 'Recording file not found.');
        return;
      }

      // Build multipart form data for the FastAPI /ai/voice endpoint
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'audio/m4a',
        name: 'voice-note.m4a',
      } as unknown as Blob);

      const result = await aiApi.voice(formData);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onNoteCreated(result.title, result.structured_content);
    } catch {
      Alert.alert('Transcription error', 'Could not transcribe voice note. Check backend connection.');
    } finally {
      setProcessing(false);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    }
  };

  const handlePress = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        recording && styles.buttonRecording,
        processing && styles.buttonProcessing,
      ]}
      onPress={handlePress}
      disabled={processing}
      activeOpacity={0.7}
    >
      {processing ? (
        <ActivityIndicator size="small" color={colors.accentPrimary} />
      ) : recording ? (
        <MicOff size={18} color={colors.danger} />
      ) : (
        <Mic size={18} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRecording: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  buttonProcessing: {
    opacity: 0.6,
  },
});
