import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendMagicLink = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: 'neuronotes://auth/callback',
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setSent(true);
      }
    } catch {
      Alert.alert('Error', 'Failed to send magic link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🧠</Text>
            </View>
            <Text style={styles.appName}>NeuroNotes</Text>
            <Text style={styles.tagline}>AI-powered knowledge workspace</Text>
          </View>

          {!sent ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>Sign in</Text>
              <Text style={styles.formSubtitle}>
                We will send a magic link to your email — no password needed.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="send"
                onSubmitEditing={handleSendMagicLink}
                editable={!loading}
              />

              <TouchableOpacity
                style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                onPress={handleSendMagicLink}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.sendButtonText}>Send Magic Link</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.privacyNote}>
                Your notes are private and encrypted. We never share your data.
              </Text>
            </View>
          ) : (
            <View style={styles.successContainer}>
              <Text style={styles.successIcon}>✉️</Text>
              <Text style={styles.successTitle}>Check your inbox</Text>
              <Text style={styles.successBody}>
                We sent a magic link to{'\n'}
                <Text style={styles.successEmail}>{email}</Text>
              </Text>
              <Text style={styles.successHint}>
                Tap the link in the email to sign in. It expires in 1 hour.
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => { setSent(false); setEmail(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.retryButtonText}>Use a different email</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  logoEmoji: {
    fontSize: 36,
  },
  appName: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  form: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  formSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  input: {
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  sendButton: {
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    marginBottom: spacing.md,
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: 'white',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  privacyNote: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  successContainer: {
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  successBody: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  successEmail: {
    color: colors.accentPrimary,
    fontWeight: fontWeight.semibold,
  },
  successHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryButtonText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
