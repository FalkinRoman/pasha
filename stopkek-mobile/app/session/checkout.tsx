import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { completeSessionCheckout, uploadCheckoutPhoto } from '../../src/api/bookings';
import { ApiError } from '../../src/api/client';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { setActiveBooking } from '../../src/store/bookingSlice';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const STEPS = [
  'Положи периферию в ячейку',
  'Сфотографируй ячейку',
  'Подтверди завершение',
] as const;

export default function CheckoutScreen() {
  const dispatch = useAppDispatch();
  const booking = useAppSelector((s) => s.booking.activeBooking);
  const [step, setStep] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нужен доступ к камере');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      setPhotoUri(res.assets[0].uri);
    }
  };

  const onNext = () => {
    if (step === 1 && !photoUri) {
      Alert.alert('Нужно фото');
      return;
    }
    setStep((s) => s + 1);
  };

  const finish = async () => {
    if (!booking) {
      router.replace('/(tabs)/home');
      return;
    }
    if (!photoUri) {
      Alert.alert('Сделайте фото ячейки');
      return;
    }
    setLoading(true);
    try {
      await uploadCheckoutPhoto(booking.id, photoUri);
      const res = await completeSessionCheckout(booking.id);
      dispatch(setActiveBooking(null));
      Alert.alert(
        'Сеанс завершён',
        res.refundRub > 0
          ? `На баланс возвращено ${res.refundRub} ₽`
          : 'Спасибо за визит',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/home') }]
      );
    } catch (e) {
      Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не удалось');
    } finally {
      setLoading(false);
    }
  };

  const isLast = step >= STEPS.length - 1;
  const progress = (step + 1) / STEPS.length;

  return (
    <Screen scroll>
      <Header title="Завершение" back />

      <View style={styles.content}>
        <View style={styles.progressBlock}>
          <View style={styles.segmentRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  i < step && styles.segmentDone,
                  i === step && styles.segmentCurrent,
                ]}
              />
            ))}
          </View>
          <View style={styles.progressMeta}>
            <Text style={styles.stepCounter}>
              Шаг {step + 1} из {STEPS.length}
            </Text>
            <Text style={styles.stepPercent}>{Math.round(progress * 100)}%</Text>
          </View>
        </View>

        <View style={styles.body}>
          {step === 1 && (
            <Pressable style={styles.photoBox} onPress={takePhoto}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} />
              ) : (
                <Text style={typography.caption}>Нажми для фото</Text>
              )}
            </Pressable>
          )}
        </View>

        <View style={styles.actionCard}>
          <Text style={styles.actionText}>{STEPS[step]}</Text>
          {isLast ? (
            <StopButton
              title="Завершить сеанс"
              onPress={finish}
              disabled={loading}
              loading={loading}
            />
          ) : (
            <StopButton title="Далее" onPress={onNext} />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingTop: spacing.lg,
    gap: spacing.xl,
  },
  progressBlock: {
    gap: spacing.md,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.bgMuted,
  },
  segmentDone: {
    backgroundColor: colors.accentMuted,
  },
  segmentCurrent: {
    backgroundColor: colors.accent,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepCounter: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  stepPercent: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  body: {
    minHeight: 120,
    justifyContent: 'center',
  },
  photoBox: {
    height: 200,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  actionCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
  },
  actionText: {
    ...typography.h3,
    textAlign: 'center',
    lineHeight: 28,
  },
});
