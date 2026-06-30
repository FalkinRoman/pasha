import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDiscountBadge } from '../../constants/bookingPricing';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ExtendHourQuote, ExtendPackageQuote } from '../../types';
import { formatMoney } from '../../utils/format';

type Props = {
  presets: ExtendHourQuote[];
  packagePresets: ExtendPackageQuote[];
  selectedHours: number;
  selectedPackageId: string | null;
  quoteLoading: boolean;
  onSelectPreset: (hours: number) => void;
  onSelectPackage: (packageId: string, hours: number) => void;
};

export function ExtendHoursSection({
  presets,
  packagePresets,
  selectedHours,
  selectedPackageId,
  quoteLoading,
  onSelectPreset,
  onSelectPackage,
}: Props) {
  if (quoteLoading && !presets.length && !packagePresets.length) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {presets.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Часы</Text>
          <View style={styles.presets}>
            {presets.map((meta) => {
              const active = !selectedPackageId && selectedHours === meta.hours;
              const hasDiscount = meta.totalPriceRub < meta.basePriceRub;
              const badgeText = formatDiscountBadge(meta.discountPercent);
              return (
                <Pressable
                  key={meta.hours}
                  style={[styles.preset, active && styles.presetActive]}
                  onPress={() => onSelectPreset(meta.hours)}
                >
                  {badgeText && (
                    <View style={[styles.discBadge, active && styles.discBadgeActive]}>
                      <Text style={[styles.discBadgeText, active && styles.discBadgeTextActive]}>
                        {badgeText}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.presetHours, active && styles.presetTextActive]}>
                    +{meta.hours} ч
                  </Text>
                  {hasDiscount ? (
                    <>
                      <Text style={[styles.presetOrigPrice, active && styles.presetOrigPriceActive]}>
                        {formatMoney(meta.basePriceRub)}
                      </Text>
                      <Text style={[styles.presetDiscPrice, active && styles.presetTextActive]}>
                        {formatMoney(meta.totalPriceRub)}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.presetDiscPrice, active && styles.presetTextActive]}>
                      {formatMoney(meta.totalPriceRub)}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {packagePresets.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, styles.packagesTitle]}>Пакеты</Text>
          <View style={styles.packages}>
            {packagePresets.map((meta) => {
              const active = selectedPackageId === meta.packageId;
              const hasDiscount = meta.totalPriceRub < meta.basePriceRub;
              const badgeText = formatDiscountBadge(meta.discountPercent);
              return (
                <Pressable
                  key={meta.packageId}
                  style={[styles.packageCard, active && styles.packageCardActive]}
                  onPress={() => onSelectPackage(meta.packageId, meta.hours)}
                >
                  {badgeText && (
                    <View style={[styles.pkgDiscBadge, active && styles.pkgDiscBadgeActive]}>
                      <Text style={[styles.pkgDiscText, active && styles.pkgDiscTextActive]}>
                        {badgeText}
                      </Text>
                    </View>
                  )}
                  <View style={styles.pkgInfo}>
                    <Text style={[typography.body, styles.pkgLabel, active && styles.pkgTextActive]}>
                      {meta.label}
                    </Text>
                    <Text style={[styles.pkgWindow, active && styles.pkgWindowActive]}>
                      {meta.window} · {meta.hours} ч
                    </Text>
                  </View>
                  <View style={styles.pkgPriceCol}>
                    {hasDiscount ? (
                      <Text style={[styles.pkgOrigPrice, active && styles.pkgOrigPriceActive]}>
                        {formatMoney(meta.basePriceRub)}
                      </Text>
                    ) : null}
                    <Text style={[styles.pkgDiscPrice, active && styles.pkgDiscPriceActive]}>
                      {formatMoney(meta.totalPriceRub)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  loadingWrap: { paddingVertical: spacing.xl, alignItems: 'center' },
  sectionTitle: { ...typography.caption, color: colors.textSecondary },
  packagesTitle: { marginTop: spacing.md },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: {
    width: '22%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingTop: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
    position: 'relative',
    minHeight: 90,
    gap: 2,
  },
  presetActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  presetTextActive: { color: '#fff' },
  presetHours: { ...typography.body, fontWeight: '700' },
  presetOrigPrice: {
    ...typography.caption,
    color: colors.textDisabled,
    textDecorationLine: 'line-through',
    fontSize: 11,
  },
  presetOrigPriceActive: { color: 'rgba(255,255,255,0.5)' },
  presetDiscPrice: { ...typography.caption, fontWeight: '600', color: colors.text },
  discBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  discBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  discBadgeText: { fontSize: 9, fontWeight: '800', color: colors.accentBright },
  discBadgeTextActive: { color: '#fff' },
  packages: { gap: spacing.sm },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  packageCardActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pkgDiscBadge: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 50,
    alignItems: 'center',
  },
  pkgDiscBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  pkgDiscText: { fontSize: 14, fontWeight: '800', color: colors.accentBright },
  pkgDiscTextActive: { color: '#fff' },
  pkgInfo: { flex: 1, minWidth: 0, gap: 2 },
  pkgLabel: { fontWeight: '700' },
  pkgWindow: { ...typography.caption, color: colors.textSecondary },
  pkgWindowActive: { color: 'rgba(255,255,255,0.75)' },
  pkgTextActive: { color: '#fff' },
  pkgPriceCol: { alignItems: 'flex-end', gap: 3, minWidth: 76, flexShrink: 0 },
  pkgOrigPrice: {
    ...typography.caption,
    color: colors.textDisabled,
    textDecorationLine: 'line-through',
  },
  pkgOrigPriceActive: { color: 'rgba(255,255,255,0.5)' },
  pkgDiscPrice: { ...typography.body, fontWeight: '700', color: colors.text },
  pkgDiscPriceActive: { color: '#fff' },
});
