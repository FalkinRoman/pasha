import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
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

type ScanGate = 'idle' | 'busy' | 'alert';

export default function ScanPcScreen() {
  const booking = useAppSelector((s) => s.booking.activeBooking);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanEnabled, setScanEnabled] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const gateRef = useRef<ScanGate>('idle');
  const lastPayloadRef = useRef('');

  const mySeat = booking?.seatNumbers?.[0];

  const showAlert = useCallback((title: string, message: string, onOk?: () => void) => {
    gateRef.current = 'alert';
    setScanEnabled(false);
    Alert.alert(title, message, [
      {
        text: 'OK',
        onPress: () => {
          gateRef.current = 'idle';
          lastPayloadRef.current = '';
          setScanEnabled(true);
          onOk?.();
        },
      },
    ]);
  }, []);

  const onScan = useCallback(
    async (raw: string) => {
      if (gateRef.current !== 'idle' || !booking) return;
      if (raw === lastPayloadRef.current) return;

      gateRef.current = 'busy';
      lastPayloadRef.current = raw;
      setScanEnabled(false);

      let data: QrPayload;
      try {
        data = JSON.parse(raw) as QrPayload;
      } catch {
        showAlert('Не тот QR', 'Наведите на QR на мониторе этого ПК');
        return;
      }
      if (!mySeat) {
        showAlert('Нет места', 'В активной брони не указан номер ПК');
        return;
      }
      if (data.v !== 2 || !data.challengeId || data.type !== 'stopkek-unlock') {
        showAlert('Не тот QR', 'Это не QR stopkek с монитора');
        return;
      }
      if (!data.seat || data.seat !== mySeat) {
        showAlert(
          'Другой ПК',
          `Ваша бронь — место #${mySeat}, на мониторе — #${data.seat ?? '—'}`
        );
        return;
      }

      setUnlocking(true);
      try {
        const res = await confirmPcQr(booking.id, data.challengeId);
        gateRef.current = 'alert';
        Alert.alert('Готово', `ПК #${res.seatNumber} разблокирован`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch (e) {
        showAlert('Ошибка', e instanceof ApiError ? e.message : 'Не удалось');
        setUnlocking(false);
      }
    },
    [booking, mySeat, showAlert]
  );

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
        Наведите на QR на экране ПК #{mySeat ?? '—'}
      </Text>
      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={
            scanEnabled ? ({ data }) => void onScan(data) : undefined
          }
        />
        <View style={styles.frame} />
      </View>
      {unlocking && <Text style={[typography.caption, styles.center]}>Разблокируем…</Text>}
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
