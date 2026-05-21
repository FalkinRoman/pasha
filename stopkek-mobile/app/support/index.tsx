import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { fetchClub, ClubInfo } from '../../src/api/club';
import { SupportContactsBlock } from '../../src/components/support/SupportContacts';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function SupportScreen() {
  const [club, setClub] = useState<ClubInfo | null>(null);

  useEffect(() => {
    fetchClub().then(setClub).catch(() => {});
  }, []);

  return (
    <Screen scroll>
      <Header title="Поддержка" back />
      <Text style={[typography.bodySecondary, { marginBottom: spacing.md }]}>
        Не пришёл звонок для входа или есть вопрос по брони — напишите или позвоните
      </Text>
      <SupportContactsBlock
        contacts={{
          supportPhone: club?.supportPhone,
          supportTelegram: club?.supportTelegram,
          supportEmail: club?.supportEmail,
        }}
      />
    </Screen>
  );
}
