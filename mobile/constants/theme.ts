/**
 * NeuroNotes Mobile Design System
 * Matches the web app dark theme exactly.
 */

export const colors = {
  // Backgrounds
  bgPrimary: '#0A0A0A',
  bgSecondary: '#111111',
  bgElevated: '#161616',
  bgTertiary: '#1A1A1A',
  bgCard: '#1A1A1A',
  bgHover: '#222222',

  // Borders
  border: '#1F1F1F',
  borderLight: '#2a2a2a',

  // Text
  textPrimary: '#F8F8F8',
  textSecondary: '#A0A0A0',
  textMuted: '#6B7280',

  // Accents
  accentPrimary: '#6366F1',
  accentSecondary: '#22C55E',
  accentWarning: '#F59E0B',
  accentError: '#EF4444',
  accentDim: 'rgba(99, 102, 241, 0.12)',

  // Semantic
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
};

export const gradients = {
  accent: ['#6366F1', '#22C55E'] as [string, string],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 28,
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
};

export const tabBarHeight = 60;
