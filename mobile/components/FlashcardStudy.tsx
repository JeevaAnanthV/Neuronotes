import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, XCircle, Minus, Brain, RotateCcw } from 'lucide-react-native';
import { type Flashcard } from '@/lib/api';
import { rateCard, hashStr, DEFAULT_CARD_STATE, type CardState } from '@/lib/sm2';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.3;

interface StudyCard extends Flashcard {
  noteId: string;
  noteTitle: string;
  state: CardState;
}

interface FlashcardStudyProps {
  cards: StudyCard[];
  onComplete: (reviewed: number) => void;
  onCardRated?: (card: StudyCard, quality: number, newState: CardState) => void;
}

const QUALITY_MAP: Record<'again' | 'hard' | 'good' | 'easy', number> = {
  again: 0,
  hard: 2,
  good: 4,
  easy: 5,
};

export function FlashcardStudy({ cards, onComplete, onCardRated }: FlashcardStudyProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const flipRotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  const flipStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${flipRotation.value * 180}deg` },
    ],
  }));

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));

  const advanceCard = (quality: number) => {
    const card = cards[currentIndex];
    const newState = rateCard(card.state, quality);
    onCardRated?.(card, quality, newState);

    const next = currentIndex + 1;
    if (next >= cards.length) {
      setDone(true);
      onComplete(cards.length);
    } else {
      setCurrentIndex(next);
      setFlipped(false);
      flipRotation.value = 0;
      translateX.value = 0;
      translateY.value = 0;
      opacity.value = 1;
    }
  };

  const handleRate = async (quality: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    opacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(advanceCard)(quality);
    });
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const { translationX, translationY } = e;
      if (translationX > SWIPE_THRESHOLD) {
        // Swipe right = Good
        translateX.value = withSpring(SCREEN_W * 1.5);
        opacity.value = withTiming(0, { duration: 200 }, () => runOnJS(advanceCard)(QUALITY_MAP.good));
      } else if (translationX < -SWIPE_THRESHOLD) {
        // Swipe left = Again
        translateX.value = withSpring(-SCREEN_W * 1.5);
        opacity.value = withTiming(0, { duration: 200 }, () => runOnJS(advanceCard)(QUALITY_MAP.again));
      } else if (translationY < -SWIPE_THRESHOLD) {
        // Swipe up = Easy
        translateY.value = withSpring(-SCREEN_W * 1.5);
        opacity.value = withTiming(0, { duration: 200 }, () => runOnJS(advanceCard)(QUALITY_MAP.easy));
      } else {
        // Snap back
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(setFlipped)(!flipped);
    flipRotation.value = withSpring(flipped ? 0 : 1);
  });

  const composed = Gesture.Simultaneous(panGesture, tapGesture);

  if (done || cards.length === 0) {
    return (
      <View style={styles.doneContainer}>
        <CheckCircle2 size={56} color={colors.success} />
        <Text style={styles.doneTitle}>Session Complete!</Text>
        <Text style={styles.doneSub}>You reviewed {cards.length} card{cards.length !== 1 ? 's' : ''}.</Text>
        <TouchableOpacity
          style={styles.reviewAgainBtn}
          onPress={() => { setCurrentIndex(0); setFlipped(false); setDone(false); flipRotation.value = 0; }}
        >
          <RotateCcw size={16} color="white" />
          <Text style={styles.reviewAgainText}>Review Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const card = cards[currentIndex];
  const progress = (currentIndex / cards.length) * 100;

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>{currentIndex + 1} / {cards.length}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      {/* Source label */}
      <Text style={styles.sourceLabel} numberOfLines={1}>{card.noteTitle}</Text>

      {/* Card */}
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.card, cardAnimStyle, flipStyle]}>
          <Text style={styles.cardLabel}>{flipped ? 'Answer' : 'Question — tap to reveal'}</Text>
          <Text style={styles.cardText}>{flipped ? card.answer : card.question}</Text>
          {!flipped && <Text style={styles.cardHint}>Swipe: → Good  ← Again  ↑ Easy</Text>}
        </Animated.View>
      </GestureDetector>

      {/* Rating buttons (shown when flipped) */}
      {flipped && (
        <View style={styles.ratingRow}>
          {[
            { label: 'Again', quality: QUALITY_MAP.again, color: colors.danger, Icon: XCircle },
            { label: 'Hard', quality: QUALITY_MAP.hard, color: colors.warning, Icon: Minus },
            { label: 'Good', quality: QUALITY_MAP.good, color: colors.success, Icon: CheckCircle2 },
            { label: 'Easy', quality: QUALITY_MAP.easy, color: colors.accentPrimary, Icon: Brain },
          ].map(({ label, quality, color, Icon }) => (
            <TouchableOpacity
              key={label}
              style={[styles.ratingBtn, { borderColor: color }]}
              onPress={() => handleRate(quality)}
              activeOpacity={0.75}
            >
              <Icon size={16} color={color} />
              <Text style={[styles.ratingLabel, { color }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!flipped && (
        <TouchableOpacity
          style={styles.revealBtn}
          onPress={() => { setFlipped(true); flipRotation.value = withSpring(1); }}
          activeOpacity={0.8}
        >
          <Text style={styles.revealBtnText}>Reveal Answer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    width: 48,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accentPrimary,
    borderRadius: 2,
  },
  sourceLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    paddingLeft: spacing.sm,
  },
  card: {
    flex: 1,
    maxHeight: 280,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  cardLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: fontWeight.medium,
  },
  cardHint: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  ratingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.bgElevated,
  },
  ratingLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  revealBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  revealBtnText: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
  },
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xxl,
  },
  doneTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  doneSub: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  reviewAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  reviewAgainText: {
    color: 'white',
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.base,
  },
});
