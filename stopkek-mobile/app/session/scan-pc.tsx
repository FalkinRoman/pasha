import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { confirmPcQr } from '../../src/api/bookings';
import { ApiError } from '../../src/api/client';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppSelector } from '../../src/store/hooks';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

type QrPayload = {
  v?: number;
  type?: string;
  seat?: number;
  challengeId?: string;
};

export default function ScanPcScreen() {
  const booking = useAppSelector((s) => s.booking.activeBooking);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const seatNum = booking?.seatNumbers[0];

  const onScan = async (raw: string) => {
    if (busy || !booking) return;
    let data: QrPayload;
    try {
      data = JSON.parse(raw) as QrPayload;
    } catch {
      Alert.alert('Не тот QR', 'Наведите на QR на мониторе этого ПК');
      return;
    }
    if (data.v !== 2 || !data.challengeId || data.type !== 'stopkek-unlock') {
      Alert.alert('Не тот QR', 'Это не QR stopkek с монитора');
      return;
    }
    if (seatNum && data.seat && data.seat !== seatNum) {
      Alert.alert(
        'Другой ПК',
        `Ваша бронь — место #${seatNum}, на мониторе — #${data.seat}`
      );
      return;
    }

    setBusy(true);
    try {
      const res = await confirmPcQr(booking.id, data.challengeId);
      Alert.alert('Готово', `ПК #${res.seatNumber} разблокирован`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не удалось');
      setBusy(false);
    }
  };

  if (!booking) {
    return (
      <Screen>
        <Header title="QR на мониторе" back />
        <Text style={typography.bodySecondary}>Нет активного сеанса</Text>
      </Screen>
    );
  }

  if (!permission?.granted) {
    return (
      <Screen>
        <Header title="QR на мониторе" back />
        <Text style={[typography.body, styles.center]}>
          Нужен доступ к камере для сканирования QR на мониторе
        </Text>
        <StopButton title="Разрешить камеру" onPress={requestPermission} />
        <StopButton title="Открыть настройки" variant="ghost" onPress={() => Linking.openSettings()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Сканируйте QR" back />
      <Text style={[typography.bodySecondary, styles.center, styles.mb]}>
        Наведите на QR на экране ПК #{seatNum ?? '—'}
      </Text>
      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={busy ? undefined : ({ data }) => onScan(data)}
        />
        <View style={styles.frame} />
      </View>
      {busy && <Text style={[typography.caption, styles.center]}>Разблокируем…</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  mb: { marginBottom: spacing.lg },
  cameraWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.accent,
    minHeight: 360,
  },
  camera: { flex: 1 },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: colors.accentBright,
    margin: 32,
    borderRadius: 12,
  },
});
