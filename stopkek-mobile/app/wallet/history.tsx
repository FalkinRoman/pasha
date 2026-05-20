import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fetchTransactions, Transaction } from '../../src/api/wallet';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopkekLoader } from '../../src/components/ui/StopkekLoader';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { formatMoney } from '../../src/utils/format';

function label(type: string) {
  if (type === 'topup') return 'Пополнение';
  if (type === 'booking_payment') return 'Оплата брони';
  if (type === 'refund') return 'Возврат';
  return 'Операция';
}

export default function WalletHistoryScreen() {
  const [list, setList] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTransactions()
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen scroll>
      <Header title="Транзакции" back />
      {loading ? (
        <StopkekLoader flex size="sm" message="Загружаем" />
      ) : (
        list.map((t) => (
          <View key={t.id} style={styles.row}>
            <View>
              <Text style={typography.body}>{label(t.type)}</Text>
              <Text style={typography.caption}>
                {new Date(t.createdAt).toLocaleDateString('ru-RU')}
              </Text>
            </View>
            <Text style={[typography.h3, { color: t.amountRub > 0 ? colors.success : colors.text }]}>
              {t.amountRub > 0 ? '+' : ''}
              {formatMoney(Math.abs(t.amountRub))}
            </Text>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
