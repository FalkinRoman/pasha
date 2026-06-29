import { Picker } from '@react-native-picker/picker';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../ui/Card';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ExtendMinuteQuote } from '../../types';

type Props = {
  presets: ExtendMinuteQuote[];
  selectedMinutes: number;
  onSelect: (minutes: number) => void;
};

export function ExtendMinutesSection({
  presets,
  selectedMinutes,
  onSelect,
}: Props) {
  return (
    <Card style={styles.card}>
      <Text style={styles.hint}>+{selectedMinutes} мин</Text>
      <View style={styles.pickerShell}>
        <Picker
          selectedValue={selectedMinutes}
          onValueChange={(value) => onSelect(Number(value))}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          {presets.map((preset) => (
            <Picker.Item
              key={preset.minutes}
              label={`${preset.minutes} мин`}
              value={preset.minutes}
              color={colors.text}
            />
          ))}
        </Picker>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  pickerShell: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  picker: {
    width: '100%',
    height: 200,
  },
  pickerItem: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
});
