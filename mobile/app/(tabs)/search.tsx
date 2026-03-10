import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { searchApi, type SearchResult } from '@/lib/api';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await searchApi.semantic(q.trim());
      setResults(data);
      setSearched(true);
    } catch {
      setError('Search failed. Check backend connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 400);
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => {
        Keyboard.dismiss();
        router.push(`/note/${item.note.id}`);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {item.note.title || 'Untitled'}
        </Text>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{Math.round(item.score * 100)}%</Text>
        </View>
      </View>
      {item.note.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {item.note.tags.slice(0, 3).map((tag) => (
            <View key={tag.id} style={styles.tag}>
              <Text style={styles.tagText}>{tag.name}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Search size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Ask anything about your notes…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={handleChangeText}
          returnKeyType="search"
          onSubmitEditing={() => doSearch(query)}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color={colors.accentPrimary} />}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => doSearch(query)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!searched && !loading && (
        <View style={styles.emptyState}>
          <Search size={48} color={colors.textMuted} style={{ opacity: 0.3 }} />
          <Text style={styles.emptyTitle}>Semantic search</Text>
          <Text style={styles.emptySub}>
            Search by meaning, not just keywords. Ask a question or describe a topic.
          </Text>
        </View>
      )}

      {searched && results.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySub}>Try rephrasing your query.</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.note.id}
        renderItem={renderResult}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    minHeight: 36,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  resultCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  resultTitle: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  scoreBadge: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  scoreText: {
    fontSize: fontSize.xs,
    color: colors.accentPrimary,
    fontWeight: fontWeight.semibold,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.danger,
  },
  retryText: {
    fontSize: fontSize.sm,
    color: colors.accentPrimary,
    fontWeight: fontWeight.semibold,
  },
});
