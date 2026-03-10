import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Brain,
  HelpCircle,
  Bell,
  Layers,
  Tag,
  Settings,
  Lightbulb,
  Mic,
  BookOpen,
  BarChart2,
  type LucideProps,
} from 'lucide-react-native';
import { type ComponentType } from 'react';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme';

interface FeatureCard {
  icon: ComponentType<LucideProps>;
  label: string;
  description: string;
  href: string;
  color: string;
}

const FEATURES: FeatureCard[] = [
  {
    icon: Brain,
    label: 'Flashcards',
    description: 'SM-2 spaced repetition study',
    href: '/flashcards',
    color: '#6366F1',
  },
  {
    icon: HelpCircle,
    label: 'Q&A',
    description: 'Ask questions across notes',
    href: '/qa',
    color: '#22C55E',
  },
  {
    icon: Bell,
    label: 'Reminders',
    description: 'Action items and due dates',
    href: '/reminders',
    color: '#F59E0B',
  },
  {
    icon: Layers,
    label: 'Clusters',
    description: 'AI-grouped note topics',
    href: '/clusters',
    color: '#8B5CF6',
  },
  {
    icon: Tag,
    label: 'Tags',
    description: 'Browse notes by tag',
    href: '/tags',
    color: '#06B6D4',
  },
  {
    icon: Lightbulb,
    label: 'Insights',
    description: 'Writing patterns and gaps',
    href: '/insights',
    color: '#EC4899',
  },
  {
    icon: Mic,
    label: 'Voice Notes',
    description: 'Record and transcribe audio',
    href: '/voice',
    color: '#EF4444',
  },
  {
    icon: BarChart2,
    label: 'Stats',
    description: 'Note activity overview',
    href: '/stats',
    color: '#14B8A6',
  },
  {
    icon: BookOpen,
    label: 'Templates',
    description: 'Start from a template',
    href: '/templates',
    color: '#F97316',
  },
  {
    icon: Settings,
    label: 'Settings',
    description: 'Preferences and account',
    href: '/settings',
    color: colors.textMuted,
  },
];

import React from 'react';

export default function MoreScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <TouchableOpacity
                key={feature.label}
                style={styles.card}
                onPress={() => router.push(feature.href as never)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconBg, { backgroundColor: feature.color + '22' }]}>
                  <Icon size={24} color={feature.color} />
                </View>
                <Text style={styles.cardLabel}>{feature.label}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {feature.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    width: '47%',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  cardLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  cardDesc: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
});
