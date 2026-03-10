import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { colors, spacing, radius, fontSize } from '@/constants/theme';

interface TagChipProps {
  name: string;
  onRemove?: () => void;
}

export function TagChip({ name, onRemove }: TagChipProps) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{name}</Text>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn} hitSlop={8}>
          <X size={10} color={colors.accentPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
    gap: 4,
  },
  chipText: {
    fontSize: fontSize.xs,
    color: colors.accentPrimary,
    fontWeight: '500',
  },
  removeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
