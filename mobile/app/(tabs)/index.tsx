import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Plus, FileText } from 'lucide-react-native';
import { useNotes } from '@/hooks/useNotes';
import { NoteCard } from '@/components/NoteCard';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme';

export default function NotesScreen() {
  const router = useRouter();
  const { notes, loading, error, refresh, createNote, deleteNote } = useNotes();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleNewNote = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const note = await createNote('Untitled', '');
      router.push(`/note/${note.id}`);
    } catch {
      Alert.alert('Error', 'Failed to create note. Is the backend running?');
    } finally {
      setCreating(false);
    }
  }, [creating, createNote, router]);

  const handleDeleteNote = useCallback(
    (id: string, title: string) => {
      Alert.alert(
        'Delete Note',
        `Delete "${title || 'Untitled'}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              try {
                await deleteNote(id);
              } catch {
                Alert.alert('Error', 'Failed to delete note.');
              }
            },
          },
        ],
      );
    },
    [deleteNote],
  );

  const renderEmpty = () => {
    if (loading) return null;
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Could not load notes</Text>
          <Text style={styles.emptySub}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <FileText size={56} color={colors.textMuted} style={{ opacity: 0.3 }} />
        <Text style={styles.emptyTitle}>No notes yet</Text>
        <Text style={styles.emptySub}>Tap the + button to create your first note.</Text>
        <TouchableOpacity style={styles.ctaButton} onPress={handleNewNote}>
          <Text style={styles.ctaButtonText}>Create first note</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NeuroNotes</Text>
        <TouchableOpacity
          style={[styles.newNoteBtn, creating && styles.newNoteBtnDisabled]}
          onPress={handleNewNote}
          disabled={creating}
          activeOpacity={0.8}
        >
          {creating ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Plus size={18} color="white" />
          )}
        </TouchableOpacity>
      </View>

      {loading && notes.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
          <Text style={styles.loadingText}>Loading notes…</Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => router.push(`/note/${item.id}`)}
              onLongPress={() => handleDeleteNote(item.id, item.title)}
            />
          )}
          contentContainerStyle={notes.length === 0 ? styles.listEmpty : styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={colors.accentPrimary}
              colors={[colors.accentPrimary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  newNoteBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  newNoteBtnDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  listEmpty: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  ctaButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.accentPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  ctaButtonText: {
    color: 'white',
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.base,
  },
  retryButton: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  retryText: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
  },
});
