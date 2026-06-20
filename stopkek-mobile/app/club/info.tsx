import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { clubImageUri, fetchClub, ClubInfo } from '../../src/api/club';
import { BRAND_NAME } from '../../src/constants/brand';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function ClubInfoScreen() {
  const [club, setClub] = useState<ClubInfo | null>(null);

  useEffect(() => {
    fetchClub().then(setClub).catch(() => {});
  }, []);

  return (
    <Screen scroll>
      <Header title="О клубе" back />
      <View style={styles.hero}>
        {clubImageUri(club?.imageUrl) ? (
          <Image source={{ uri: clubImageUri(club?.imageUrl)! }} style={styles.photo} />
        ) : (
          <View style={styles.photo} />
        )}
        <Text style={typography.h1}>{club?.name ?? BRAND_NAME}</Text>
        <View style={styles.row}>
          <Ionicons name="star" size={16} color={colors.warning} />
          <Text style={typography.body}>{club?.rating ?? 5}</Text>
        </View>
      </View>
      <View style={styles.row}>
        <Ionicons name="location-outline" size={20} color={colors.accent} />
        <Text style={typography.body}>{club?.address ?? ''}</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="time-outline" size={20} color={colors.accent} />
        <Text style={typography.body}>{club?.hours ?? '24/7'}</Text>
      </View>
      {club?.zones?.length ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Text style={typography.h3}>Зоны</Text>
          {club.zones.map((z) => (
            <Text key={z.id} style={typography.bodySecondary}>
              {z.name} — {z.specs} · {z.pricePerHour} ₽/ч
            </Text>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  photo: {
    width: '100%',
    height: 160,
    backgroundColor: colors.bgMuted,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
});
