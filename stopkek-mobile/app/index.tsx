import { Redirect } from 'expo-router';
import { StopkekLoader } from '../src/components/ui/StopkekLoader';
import { useAppSelector } from '../src/store/hooks';

export default function Index() {
  const { isAuthenticated, hasSeenWelcome, hydrated, needsProfileSetup } = useAppSelector(
    (s) => s.auth
  );

  if (!hydrated) {
    return <StopkekLoader fullScreen size="lg" message="Загружаем" />;
  }

  if (!isAuthenticated) {
    if (!hasSeenWelcome) return <Redirect href="/(auth)/welcome" />;
    return <Redirect href="/(auth)/phone" />;
  }

  if (needsProfileSetup) return <Redirect href="/(auth)/setup-name" />;

  return <Redirect href="/(tabs)/home" />;
}
