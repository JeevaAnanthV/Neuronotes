import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { type NoteListItem } from '@/lib/api';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme';

interface NoteCardProps {
  note: NoteListItem;
  onPress: () => void;
  onLongPress?: () => void;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NoteCard({ note, onPress, onLongPress }: NoteCardProps) {
  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const handleLongPress = async () => {
    if (!onLongPress) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.75}
      delayLongPress={500}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {note.title || 'Untitled'}
        </Text>
        <Text style={styles.date}>{timeAgo(note.updated_at)}</Text>
      </View>

      {note.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {note.tags.slice(0, 4).map((tag) => (
            <View key={tag.id} style={styles.tag}>
              <Text style={styles.tagText}>{tag.name}</Text>
            </View>
          ))}
          {note.tags.length > 4 && (
            <Text style={styles.moreText}>+{note.tags.length - 4}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  date: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    flexShrink: 0,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
  },
  tagText: {
    fontSize: fontSize.xs,
    color: colors.accentPrimary,
    fontWeight: fontWeight.medium,
  },
  moreText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    alignSelf: 'center',
  },
});
