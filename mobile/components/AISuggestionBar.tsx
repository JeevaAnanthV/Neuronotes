import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Sparkles, X } from 'lucide-react-native';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme';

interface AISuggestionBarProps {
  suggestion: string;
  onInsert: () => void;
  onDismiss: () => void;
}

export function AISuggestionBar({ suggestion, onInsert, onDismiss }: AISuggestionBarProps) {
  const handleInsert = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onInsert();
  };

  const handleDismiss = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  return (
    <View style={styles.bar}>
      <View style={styles.iconContainer}>
        <Sparkles size={14} color={colors.accentPrimary} />
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.label}>AI Suggestion</Text>
        <Text style={styles.suggestion} numberOfLines={2}>{suggestion}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.insertBtn} onPress={handleInsert} activeOpacity={0.8}>
          <Text style={styles.insertText}>Insert</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss} activeOpacity={0.7}>
          <X size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accentPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestion: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  insertBtn: {
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    minHeight: 32,
    justifyContent: 'center',
  },
  insertText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: 'white',
  },
  dismissBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
});
