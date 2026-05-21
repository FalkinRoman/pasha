import { Text, TextStyle } from 'react-native';
import { BRAND_NAME } from '../../constants/brand';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, number> = {
  sm: 13,
  md: 28,
  lg: 40,
};

type Props = {
  size?: Size;
  color?: string;
  style?: TextStyle;
};

/** Название бренда «стопкек» — шрифт как на знаке STOP */
export function BrandTitle({ size = 'md', color = colors.accent, style }: Props) {
  return (
    <Text
      style={[
        typography.brand,
        { fontSize: SIZES[size], color },
        style,
      ]}
    >
      {BRAND_NAME}
    </Text>
  );
}
