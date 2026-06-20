import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { submitIdentityPhoto } from '../../src/api/identity';
import { fetchMe } from '../../src/api/users';
import { Header } from '../../src/components/ui/Header';
import { StopButton } from '../../src/components/ui/StopButton';
import { PassportFrameOverlay } from '../../src/components/verification/PassportFrameOverlay';
import { useAppDispatch } from '../../src/store/hooks';
import { updateUser } from '../../src/store/authSlice';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

type Phase = 'camera' | 'preview';

export default function VerificationCameraScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('camera');
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const takePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (photo?.uri) {
        setUri(photo.uri);
        setPhase('preview');
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось сделать снимок');
    } finally {
      setCapturing(false);
    }
  };

  const retake = () => {
    setUri(null);
    setPhase('camera');
  };

  const onSubmit = async () => {
    if (!uri) return;
    setLoading(true);
    try {
      await submitIdentityPhoto(uri);
      const user = await fetchMe();
      dispatch(updateUser(user));
      router.replace('/verification/pending');
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось отправить');
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header title="Фото с паспортом" back />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingHorizontal: spacing.lg }]}>
        <Header title="Фото с паспортом" back />
        <Text style={styles.permText}>
          Нужен доступ к камере для фото с паспортом.
        </Text>
        <StopButton title="Разрешить камеру" onPress={requestPermission} />
        <StopButton
          title="Открыть настройки"
          variant="ghost"
          onPress={() => Linking.openSettings()}
          style={{ marginTop: spacing.md }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.pad}>
        <Header title="Фото с паспортом" back />
        <Text style={styles.subtitle}>
          {phase === 'camera'
            ? 'Совместите лицо и паспорт с контуром'
            : 'Проверьте снимок перед отправкой'}
        </Text>
      </View>

      <View style={styles.frameWrap}>
        {phase === 'camera' ? (
          <>
            <CameraView ref={cameraRef} style={styles.camera} facing="front" />
            <PassportFrameOverlay />
          </>
        ) : (
          <View style={styles.previewWrap}>
            {uri && (
              <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
            )}
          </View>
        )}
      </View>

      <View style={[styles.footer, styles.pad, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {phase === 'camera' ? (
          <StopButton
            title={capturing ? 'Снимок…' : 'Сделать фото'}
            onPress={takePhoto}
            loading={capturing}
          />
        ) : (
          <View style={styles.previewActions}>
            <StopButton
              title={loading ? 'Отправка…' : 'Отправить на проверку'}
              onPress={onSubmit}
              loading={loading}
              disabled={!uri}
            />
            <StopButton
              title="Переснять"
              variant="ghost"
              onPress={retake}
              disabled={loading}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pad: {
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    ...typography.bodySecondary,
    marginBottom: spacing.md,
  },
  frameWrap: {
    flex: 1,
    position: 'relative',
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 360,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  previewWrap: {
    flex: 1,
    position: 'relative',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  footer: {
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  previewActions: {
    gap: spacing.md,
  },
  permText: {
    ...typography.bodySecondary,
    marginVertical: spacing.xl,
    textAlign: 'center',
  },
});
