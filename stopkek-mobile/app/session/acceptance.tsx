import { Redirect } from 'expo-router';

export default function AcceptanceRedirect() {
  return <Redirect href="/session/active" />;
}
