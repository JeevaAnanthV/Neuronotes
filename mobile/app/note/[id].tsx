import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Sparkles,
  Trash2,
  Tag,
  Brain,
  FileText,
  Expand,
  Mic,
  Link,
  X,
  Check,
  Loader2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { notesApi, aiApi, type Note, type NoteListItem, type Flashcard } from '@/lib/api';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { AISuggestionBar } from '@/components/AISuggestionBar';
import { TagChip } from '@/components/TagChip';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme';

const AUTOSAVE_DELAY = 1500;
const COACH_DELAY = 2000;
const COACH_MIN_CHARS = 50;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

interface AIBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
  loading: boolean;
}

function AIBottomSheet({ visible, onClose, onAction, loading }: AIBottomSheetProps) {
  const actions = [
    { key: 'tags', label: 'Generate Tags', icon: Tag, description: 'Auto-tag this note with AI' },
    { key: 'flashcards', label: 'Flashcards', icon: Brain, description: 'Create study cards' },
    { key: 'summarize', label: 'Summarize', icon: FileText, description: 'Condense to key points' },
    { key: 'expand', label: 'Expand Ideas', icon: Expand, description: 'Elaborate on content' },
    { key: 'related', label: 'Related Notes', icon: Link, description: 'Find connected notes' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetScrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Sparkles size={18} color={colors.accentPrimary} />
          <Text style={styles.sheetTitle}>AI Actions</Text>
          <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
            <X size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.sheetLoading}>
            <ActivityIndicator color={colors.accentPrimary} size="large" />
            <Text style={styles.sheetLoadingText}>AI is working…</Text>
          </View>
        ) : (
          actions.map((action) => {
            const Icon = action.icon;
            return (
              <TouchableOpacity
                key={action.key}
                style={styles.sheetAction}
                onPress={() => onAction(action.key)}
                activeOpacity={0.7}
              >
                <View style={styles.sheetActionIcon}>
                  <Icon size={20} color={colors.accentPrimary} />
                </View>
                <View style={styles.sheetActionText}>
                  <Text style={styles.sheetActionLabel}>{action.label}</Text>
                  <Text style={styles.sheetActionDesc}>{action.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </Modal>
  );
}

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [loading, setLoading] = useState(true);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [relatedNotes, setRelatedNotes] = useState<NoteListItem[]>([]);
  const [flashcardsResult, setFlashcardsResult] = useState<Flashcard[] | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coachTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    notesApi
      .get(id)
      .then((n) => {
        setNote(n);
        setTitle(n.title || '');
        setBody(stripHtml(n.content || ''));
      })
      .catch(() => {
        Alert.alert('Error', 'Note not found.');
        router.back();
      })
      .finally(() => setLoading(false));

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (coachTimer.current) clearTimeout(coachTimer.current);
    };
  }, [id, router]);

  const saveNow = useCallback(
    async (t: string, b: string) => {
      setSaving('saving');
      try {
        await notesApi.update(id, { title: t, content: `<p>${b.replace(/\n/g, '</p><p>')}</p>` });
        setSaving('saved');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setSaving('idle'), 2000);
      } catch {
        setSaving('idle');
      }
    },
    [id],
  );

  const scheduleSave = useCallback(
    (t: string, b: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveNow(t, b), AUTOSAVE_DELAY);
    },
    [saveNow],
  );

  const handleTitleChange = (text: string) => {
    setTitle(text);
    scheduleSave(text, body);
  };

  const handleBodyChange = (text: string) => {
    setBody(text);
    scheduleSave(title, text);

    // Writing coach
    if (coachTimer.current) clearTimeout(coachTimer.current);
    setAiSuggestion(null);
    if (text.length >= COACH_MIN_CHARS) {
      coachTimer.current = setTimeout(async () => {
        try {
          const { suggestion } = await aiApi.writingCoach(text.slice(-400));
          if (suggestion) setAiSuggestion(suggestion);
        } catch { /* silent */ }
      }, COACH_DELAY);
    }
  };

  const handleAIAction = useCallback(
    async (action: string) => {
      if (!body.trim()) {
        Alert.alert('Empty note', 'Add some content before using AI features.');
        return;
      }
      setAiLoading(true);
      try {
        switch (action) {
          case 'tags': {
            const { tags } = await aiApi.generateTags(body);
            for (const tag of tags) {
              try { await notesApi.addTag(id, tag); } catch { /* ignore */ }
            }
            const updated = await notesApi.get(id);
            setNote(updated);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Tags added', tags.join(', '));
            break;
          }
          case 'flashcards': {
            const { flashcards } = await aiApi.flashcards(body);
            setFlashcardsResult(flashcards);
            Alert.alert('Flashcards', `Generated ${flashcards.length} flashcard${flashcards.length !== 1 ? 's' : ''}.`);
            break;
          }
          case 'summarize': {
            const { result } = await aiApi.writingAssist(body, 'summarize');
            setBody((prev) => prev + '\n\n--- Summary ---\n' + result);
            scheduleSave(title, body + '\n\n--- Summary ---\n' + result);
            break;
          }
          case 'expand': {
            const { expanded } = await aiApi.expandIdea(body.slice(0, 300));
            const addition = '\n\n' + expanded.map((e) => `• ${e}`).join('\n');
            setBody((prev) => prev + addition);
            scheduleSave(title, body + addition);
            break;
          }
          case 'related': {
            const { suggestions } = await aiApi.linkSuggestions(id);
            setRelatedNotes(suggestions);
            break;
          }
        }
      } catch {
        Alert.alert('AI Error', 'AI service unavailable. Check backend connection.');
      } finally {
        setAiLoading(false);
        setAiSheetOpen(false);
      }
    },
    [body, id, title, scheduleSave],
  );

  const handleDelete = useCallback(() => {
    Alert.alert('Delete Note', 'Delete this note? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          try {
            await notesApi.delete(id);
            router.back();
          } catch {
            Alert.alert('Error', 'Failed to delete note.');
          }
        },
      },
    ]);
  }, [id, router]);

  const handleVoiceNote = useCallback(
    async (voiceTitle: string, voiceContent: string) => {
      const cleaned = stripHtml(voiceContent);
      setTitle(voiceTitle);
      setBody(cleaned);
      await saveNow(voiceTitle, cleaned);
    },
    [saveNow],
  );

  const handleRemoveTag = useCallback(
    async (tagName: string) => {
      try {
        const updated = await notesApi.removeTag(id, tagName);
        setNote(updated);
      } catch { /* ignore */ }
    },
    [id],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.topBarTitle} numberOfLines={1}>{title || 'Untitled'}</Text>

        <View style={styles.topBarActions}>
          {/* Save indicator */}
          {saving === 'saving' && <ActivityIndicator size="small" color={colors.accentPrimary} style={{ marginRight: 4 }} />}
          {saving === 'saved' && <Check size={15} color={colors.success} style={{ marginRight: 4 }} />}

          <VoiceRecorder onNoteCreated={handleVoiceNote} />

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setAiSheetOpen(true)}
            activeOpacity={0.7}
          >
            <Sparkles size={18} color={colors.accentPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 52 : 0}
      >
        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          {/* Title input */}
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={handleTitleChange}
            placeholder="Untitled"
            placeholderTextColor={colors.textMuted}
            multiline={false}
            returnKeyType="next"
          />

          {/* Tags row */}
          {note && note.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {note.tags.map((tag) => (
                <TagChip
                  key={tag.id}
                  name={tag.name}
                  onRemove={() => handleRemoveTag(tag.name)}
                />
              ))}
            </View>
          )}

          {/* Body */}
          <TextInput
            style={styles.bodyInput}
            value={body}
            onChangeText={handleBodyChange}
            placeholder="Start writing… (use AI button for smart features)"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
          />

          {/* Related notes */}
          {relatedNotes.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.relatedTitle}>Related Notes</Text>
              {relatedNotes.map((rn) => (
                <TouchableOpacity
                  key={rn.id}
                  style={styles.relatedItem}
                  onPress={() => router.push(`/note/${rn.id}`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.relatedItemTitle}>{rn.title || 'Untitled'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* AI suggestion bar above keyboard */}
        {aiSuggestion && (
          <AISuggestionBar
            suggestion={aiSuggestion}
            onInsert={() => {
              setBody((prev) => prev + ' ' + aiSuggestion);
              setAiSuggestion(null);
              scheduleSave(title, body + ' ' + aiSuggestion);
            }}
            onDismiss={() => setAiSuggestion(null)}
          />
        )}
      </KeyboardAvoidingView>

      <AIBottomSheet
        visible={aiSheetOpen}
        onClose={() => setAiSheetOpen(false)}
        onAction={handleAIAction}
        loading={aiLoading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  topBarTitle: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  scrollView: {
    flex: 1,
  },
  titleInput: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  bodyInput: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    lineHeight: 26,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    minHeight: 300,
  },
  relatedSection: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  relatedTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  relatedItem: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  relatedItemTitle: {
    fontSize: fontSize.base,
    color: colors.accentPrimary,
  },
  // Bottom sheet styles
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  sheetTitle: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  sheetClose: {
    padding: 4,
  },
  sheetLoading: {
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  sheetLoadingText: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetActionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionText: {
    flex: 1,
  },
  sheetActionLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  sheetActionDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
});
