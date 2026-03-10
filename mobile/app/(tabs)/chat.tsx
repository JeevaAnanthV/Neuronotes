import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { aiApi, type NoteListItem } from '@/lib/api';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: NoteListItem[];
  sourcesExpanded?: boolean;
}

function SourcesRow({ sources }: { sources: NoteListItem[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.sourcesContainer}>
      <TouchableOpacity
        style={styles.sourcesToggle}
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.7}
      >
        <Text style={styles.sourcesLabel}>
          {sources.length} source{sources.length !== 1 ? 's' : ''}
        </Text>
        {expanded ? (
          <ChevronDown size={12} color={colors.textMuted} />
        ) : (
          <ChevronRight size={12} color={colors.textMuted} />
        )}
      </TouchableOpacity>
      {expanded && (
        <View style={styles.sourcesList}>
          {sources.map((s) => (
            <Text key={s.id} style={styles.sourceItem}>
              • {s.title || 'Untitled'}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    setInput('');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const apiMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: q },
      ];
      const { reply, sources } = await aiApi.chat(apiMessages);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, sources, sourcesExpanded: false },
      ]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I could not reach the backend. Please check your connection.',
        },
      ]);
      Alert.alert('Error', 'AI chat unavailable. Is the backend running?');
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, loading, messages]);

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageRow,
        item.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant,
      ]}
    >
      <View
        style={[
          styles.bubble,
          item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
          ]}
        >
          {item.content}
        </Text>
      </View>
      {item.role === 'assistant' && item.sources && item.sources.length > 0 && (
        <SourcesRow sources={item.sources} />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <MessageSquare size={18} color={colors.accentPrimary} />
        <Text style={styles.headerTitle}>AI Chat</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, idx) => String(idx)}
          renderItem={renderMessage}
          contentContainerStyle={
            messages.length === 0 ? styles.listEmpty : styles.listContent
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MessageSquare size={48} color={colors.textMuted} style={{ opacity: 0.3 }} />
              <Text style={styles.emptyTitle}>Ask across all your notes</Text>
              <Text style={styles.emptySub}>
                I search your knowledge base and give you cited answers.
              </Text>
            </View>
          }
          ListFooterComponent={
            loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.accentPrimary} />
                <Text style={styles.loadingText}>Searching notes…</Text>
              </View>
            ) : null
          }
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Ask a question about your notes…"
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            <Send size={18} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    gap: spacing.sm,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
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
    minHeight: 300,
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
  messageRow: {
    marginBottom: spacing.md,
  },
  messageRowUser: {
    alignItems: 'flex-end',
  },
  messageRowAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  bubbleUser: {
    backgroundColor: colors.accentPrimary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: 'white',
  },
  bubbleTextAssistant: {
    color: colors.textPrimary,
  },
  sourcesContainer: {
    marginTop: spacing.xs,
    maxWidth: '85%',
  },
  sourcesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  sourcesLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  sourcesList: {
    paddingLeft: spacing.sm,
    paddingTop: 4,
    gap: 2,
  },
  sourceItem: {
    fontSize: fontSize.xs,
    color: colors.accentPrimary,
    lineHeight: 18,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgPrimary,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
