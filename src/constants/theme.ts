export const THEME = {
  colors: {
    // Backgrounds
    background: '#0B0B0E',
    backgroundSecondary: '#0E0E12',
    backgroundAmoled: '#000000',
    
    // Surfaces
    surface: '#14141A',
    surfaceElevated: '#1C1C24',
    surfaceHighlight: '#242430',
    surfaceHover: '#1E1E28',
    surfaceLight: '#242430',
    surfaceBorder: 'rgba(255, 255, 255, 0.08)',
    
    // Borders
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.14)',
    borderSubtle: 'rgba(255, 255, 255, 0.04)',
    divider: 'rgba(255, 255, 255, 0.06)',
    
    // Primary & Accents
    primary: '#FF0033',
    primaryLight: '#FF3355',
    primaryDark: '#CC0029',
    primaryGlow: 'rgba(255, 0, 51, 0.25)',
    accent: '#FF4D6D',
    accentGold: '#FFD700',
    accentBlue: '#38BDF8',
    
    // Typography Colors (Soft off-white to reduce eye fatigue)
    textPrimary: '#F4F4F6',
    textSecondary: 'rgba(244, 244, 246, 0.68)',
    textTertiary: 'rgba(244, 244, 246, 0.42)',
    textMuted: 'rgba(244, 244, 246, 0.32)',
    
    // Status
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    liveBadge: '#FF0033',
    
    // Media & Overlays
    overlay: 'rgba(0, 0, 0, 0.75)',
    overlayLight: 'rgba(0, 0, 0, 0.45)',
    playerBackground: '#000000',
  },
  
  // 8pt Grid System
  spacing: {
    none: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48,
  },
  
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
    full: 9999,
  },
  
  typography: {
    hero: {
      fontSize: 24,
      fontWeight: '700' as const,
      lineHeight: 30,
      color: '#F4F4F6',
      letterSpacing: -0.5,
    },
    title: {
      fontSize: 18,
      fontWeight: '700' as const,
      lineHeight: 24,
      color: '#F4F4F6',
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 15,
      fontWeight: '600' as const,
      lineHeight: 20,
      color: '#F4F4F6',
    },
    body: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
      color: 'rgba(244, 244, 246, 0.72)',
    },
    caption: {
      fontSize: 12,
      fontWeight: '500' as const,
      lineHeight: 16,
      color: 'rgba(244, 244, 246, 0.48)',
    },
    overline: {
      fontSize: 10,
      fontWeight: '700' as const,
      lineHeight: 14,
      color: 'rgba(244, 244, 246, 0.60)',
      letterSpacing: 0.8,
      textTransform: 'uppercase' as const,
    },
  },
  
  motion: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
  
  touch: {
    minTarget: 44,
  },
} as const;

export type ThemeColors = typeof THEME.colors;
export type Spacing = typeof THEME.spacing;
export type BorderRadius = typeof THEME.borderRadius;

