import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { submitSessionAcceptanceWithPhoto } from '../../src/api/bookings';
import { ApiError } from '../../src/api/client';
import { Header } from '../../src/components/ui/Header';
import { StopButton } from '../../src/components/ui/StopButton';
import { Input } from '../../src/components/ui/Input';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { setActiveBooking } from '../../src/store/bookingSlice';
import { colors } from '../../src/theme/colors';
import { SCREEN_PADDING } from '../../src/theme/layout';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const ITEMS = ['Мышь', 'Клавиатура', 'Наушники'] as const;

const bgSource = require('../../assets/brand/bg-mobile.png');

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.checkRow,
        checked && styles.checkRowOn,
        pressed && styles.checkRowPressed,
      ]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={[styles.checkLabel, checked && styles.checkLabelOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function AcceptanceScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const booking = useAppSelector((s) => s.booking.activeBooking);
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allPresent = ITEMS.every((i) => present[i]);
  const missing = ITEMS.filter((i) => !present[i]);

  const toggle = (item: string) => {
    setPresent((c) => ({ ...c, [item]: !c[item] }));
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нужен доступ к камере');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) {
      setPhotoUri(res.assets[0].uri);
    }
  };

  const submit = async (hasIssue: boolean) => {
    if (!booking) {
      router.replace('/(tabs)/home');
      return;
    }
    if (!hasIssue && !allPresent) {
      Alert.alert('Отметьте всё оборудование', 'Поставьте галочки у всего, что на месте');
      return;
    }
    if (hasIssue && allPresent && !comment.trim() && !photoUri) {
      Alert.alert(
        'Опишите проблему',
        'Снимите галочку с отсутствующего или добавьте комментарий / фото'
      );
      return;
    }

    const items: Record<string, boolean> = {};
    for (const i of ITEMS) {
      items[i] = Boolean(present[i]);
    }

    setLoading(true);
    try {
      const updated = await submitSessionAcceptanceWithPhoto(
        booking.id,
        items,
        hasIssue,
        comment.trim() || undefined,
        photoUri ?? undefined
      );
      dispatch(setActiveBooking(updated));
      if (hasIssue || updated.sessionPhase === 'issue') {
        Alert.alert(
          'Заявка отправлена',
          'Администратор свяжется с вами.',
          [{ text: 'OK', onPress: () => router.replace('/session/active') }]
        );
      } else {
        router.replace('/session/active');
      }
    } catch (e) {
      Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не отправлено');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ImageBackground
        source={bgSource}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={styles.overlay} />

      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.headerWrap}>
          <Header title="Приёмка места" back />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.lead}>
            Отметьте, что есть на месте. Если чего-то нет — оставьте без галочки.
          </Text>

          <Text style={styles.sectionTitle}>Всё на месте?</Text>
          <Text style={styles.sectionHint}>
            Выберите оборудование, которое видите на месте
          </Text>

          <View style={styles.checkList}>
            {ITEMS.map((item) => (
              <CheckRow
                key={item}
                label={item}
                checked={Boolean(present[item])}
                onToggle={() => toggle(item)}
              />
            ))}
          </View>

          {missing.length > 0 && (
            <View style={styles.missingBox}>
              <Text style={styles.missingTitle}>Не хватает</Text>
              <Text style={styles.missingText}>{missing.join(' · ')}</Text>
            </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
            Фото и комментарий
          </Text>
          <Text style={styles.sectionHint}>По желанию; при проблеме — желательно</Text>

          <Pressable style={styles.photoBox} onPress={takePhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            ) : (
              <Text style={typography.caption}>Сделать фото ячейки</Text>
            )}
          </Pressable>

          <Input
            label="Комментарий"
            value={comment}
            onChangeText={setComment}
            placeholder="Например: нет наушников"
            multiline
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: spacing.md }]}>
          <StopButton
            title="Всё в порядке"
            variant="success"
            onPress={() => submit(false)}
            disabled={loading || !allPresent}
            loading={loading}
          />
          <StopButton
            title="Есть проблема"
            variant="ghost"
            onPress={() => submit(true)}
            disabled={loading}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  container: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
  },
  headerWrap: {
    marginBottom: spacing.sm,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  lead: {
    ...typography.bodySecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: 4,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  checkList: {
    gap: spacing.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  checkRowOn: {
    borderColor: colors.success,
    backgroundColor: 'rgba(46, 125, 50, 0.12)',
  },
  checkRowPressed: {
    opacity: 0.9,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  checkMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkLabel: {
    ...typography.body,
    flex: 1,
  },
  checkLabelOn: {
    fontWeight: '600',
  },
  missingBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(198, 40, 40, 0.45)',
    backgroundColor: 'rgba(198, 40, 40, 0.1)',
  },
  missingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef9a9a',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  missingText: {
    ...typography.body,
    color: colors.text,
  },
  photoBox: {
    height: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
    backgroundColor: colors.bgCard,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  footer: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },
});
