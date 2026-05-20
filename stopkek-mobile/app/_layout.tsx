import 'react-native-gesture-handler';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts as useManrope,
} from '@expo-google-fonts/manrope';
import { PermanentMarker_400Regular, useFonts as useMarker } from '@expo-google-fonts/permanent-marker';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { useAppBootstrap } from '../src/hooks/useAppBootstrap';
import { store } from '../src/store';
import { StopkekLoader } from '../src/components/ui/StopkekLoader';
import { colors } from '../src/theme/colors';

function Bootstrapper({ children }: { children: ReactNode }) {
  useAppBootstrap();
  return children;
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [manropeLoaded] = useManrope({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const [markerLoaded] = useMarker({ PermanentMarker_400Regular });
  const loaded = manropeLoaded && markerLoaded;

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) {
    return <StopkekLoader fullScreen size="lg" message="stopkek" />;
  }

  return (
    <Provider store={store}>
      <Bootstrapper>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="booking" />
        <Stack.Screen name="session" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="support" />
        <Stack.Screen name="club" />
        <Stack.Screen name="verification" />
        <Stack.Screen name="legal" />
      </Stack>
      </Bootstrapper>
    </Provider>
  );
}
