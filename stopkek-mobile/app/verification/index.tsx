import { useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../../src/components/ui/Header';
import { StopButton } from '../../src/components/ui/StopButton';
import { SCREEN_PADDING } from '../../src/theme/layout';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

/** Положи сюда картинку из Nano Banana: assets/brand/verification-guide.png */
let guideImage: number | null = null;
try {
  guideImage = require('../../assets/brand/verification-guide.png');
} catch {
  guideImage = null;
}

const guideAsset = guideImage ? Image.resolveAssetSource(guideImage) : null;
const guideAspect =
  guideAsset?.width && guideAsset?.height
    ? guideAsset.width / guideAsset.height
    : 4 / 5;

export default function VerificationIntroScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [pdOk, setPdOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);

  const canContinue = pdOk && termsOk;

  const openCamera = async () => {
    if (!permission?.granted) {
      const perm = await requestPermission();
      if (!perm.granted) {
        Alert.alert(
          'Доступ к камере',
          'Разрешите камеру в настройках телефона, чтобы сделать фото с паспортом.'
        );
        return;
      }
    }
    router.push('/verification/camera');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={[styles.pad, styles.headerWrap]}>
        <Header title="Верификация" back />
      </View>

      <View style={[styles.pad, styles.content]}>
        <Text style={styles.title}>Паспорт для доступа</Text>
        <Text style={styles.lead}>
          Перед бронированием подтвердите личность: селфи с паспортом в руке, как на
          примере.
        </Text>

        <View style={styles.guideCard}>
          {guideImage ? (
            <View style={[styles.imageWrap, { aspectRatio: guideAspect }]}>
              <Image
                source={guideImage}
                style={styles.guideImage}
                resizeMode="cover"
                accessibilityLabel="Пример: лицо и паспорт в кадре"
              />
            </View>
          ) : (
            <View style={styles.guidePlaceholder}>
              <Text style={styles.placeholderText}>
                Добавьте verification-guide.png в assets/brand
              </Text>
            </View>
          )}
          <Text style={styles.guideCaption}>
            Лицо и документ в кадре · без бликов · данные читаются
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.footer,
          styles.pad,
          { paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        <View style={styles.consentCard}>
          <Pressable onPress={() => router.push('/legal/privacy')}>
            <Text style={styles.link}>Политика конфиденциальности</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/legal/terms')}>
            <Text style={styles.link}>Пользовательское соглашение</Text>
          </Pressable>

          <CheckRow
            checked={pdOk}
            onToggle={() => setPdOk((v) => !v)}
            label="Согласен на обработку персональных данных"
          />
          <CheckRow
            checked={termsOk}
            onToggle={() => setTermsOk((v) => !v)}
            label="Принимаю пользовательское соглашение"
          />
        </View>

        <StopButton
          title="Открыть камеру"
          onPress={openCamera}
          disabled={!canContinue}
        />
      </View>
    </View>
  );
}

function CheckRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Pressable style={styles.checkRow} onPress={onToggle}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked && <Text style={styles.checkMark}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pad: {
    paddingHorizontal: SCREEN_PADDING,
  },
  headerWrap: {
    marginBottom: spacing.sm,
  },
  content: {
    flex: 1,
  },
  title: { ...typography.h2, marginBottom: spacing.sm },
  lead: { ...typography.bodySecondary, marginBottom: spacing.md },
  guideCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  imageWrap: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgCard,
  },
  guideImage: {
    width: '100%',
    height: '100%',
  },
  guidePlaceholder: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  placeholderText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  guideCaption: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(10,10,10,0.92)',
  },
  consentCard: {
    gap: spacing.sm,
  },
  link: {
    ...typography.caption,
    color: colors.accent,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: '#fff', fontWeight: '700', fontSize: 14 },
  checkLabel: { ...typography.body, flex: 1, fontSize: 14, lineHeight: 20 },
});
