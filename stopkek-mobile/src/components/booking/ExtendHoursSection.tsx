import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ExtendHourQuote } from '../../types';
import { formatMoney } from '../../utils/format';

type Props = {
  presets: ExtendHourQuote[];
  selectedHours: number;
  quoteLoading: boolean;
  onSelect: (hours: number) => void;
};

export function ExtendHoursSection({
  presets,
  selectedHours,
  quoteLoading,
  onSelect,
}: Props) {
  return (
    <View style={styles.list}>
      {presets.map((preset) => {
        const active = selectedHours === preset.hours;
        return (
          <Pressable
            key={preset.hours}
            style={[styles.row, active && styles.rowActive]}
            onPress={() => onSelect(preset.hours)}
          >
            <View style={styles.left}>
              <Text style={[styles.label, active && styles.textActive]}>
                +{preset.hours} ч
              </Text>
              {preset.badge ? (
                <Text style={[styles.badge, active && styles.badgeActive]}>
                  {preset.badge}
                </Text>
              ) : null}
            </View>
            <View style={styles.priceCol}>
              {preset.discountRub > 0 ? (
                <Text style={[styles.basePrice, active && styles.basePriceActive]}>
                  {formatMoney(preset.basePriceRub)}
                </Text>
              ) : null}
              {quoteLoading && active ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={[styles.price, active && styles.textActive]}>
                  {formatMoney(preset.totalPriceRub)}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  rowActive: {
    borderColor: colors.accent,
    backgroundColor: '#1a1010',
  },
  left: { gap: 4 },
  label: { ...typography.h3 },
  badge: { ...typography.caption, color: colors.accentBright },
  badgeActive: { color: 'rgba(255,255,255,0.85)' },
  priceCol: { alignItems: 'flex-end', gap: 2 },
  price: { ...typography.bodySecondary },
  textActive: { color: '#fff' },
  basePrice: {
    ...typography.caption,
    textDecorationLine: 'line-through',
    color: colors.textDisabled,
  },
  basePriceActive: { color: 'rgba(255,255,255,0.5)' },
});
