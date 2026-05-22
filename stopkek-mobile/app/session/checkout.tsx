import { Redirect } from 'expo-router';

export default function CheckoutRedirect() {
  return <Redirect href="/session/active" />;
}
