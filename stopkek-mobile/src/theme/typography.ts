import { TextStyle } from 'react-native';

export const typography = {
  brand: {
    fontFamily: 'Oswald_700Bold',
    fontSize: 36,
    color: '#FFFFFF',
    letterSpacing: 3,
    textTransform: 'uppercase',
  } as TextStyle,
  h1: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  } as TextStyle,
  h2: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 22,
    color: '#FFFFFF',
  } as TextStyle,
  h3: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 17,
    color: '#FFFFFF',
  } as TextStyle,
  body: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
  } as TextStyle,
  bodySecondary: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: '#9E9E9E',
    lineHeight: 22,
  } as TextStyle,
  caption: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: '#9E9E9E',
  } as TextStyle,
  timer: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 52,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  button: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  } as TextStyle,
};
