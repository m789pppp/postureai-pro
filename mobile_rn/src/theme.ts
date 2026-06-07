// theme.ts — PostureAI Mobile design tokens
export const COLORS = {
  primary:  '#6366f1',
  accent:   '#0ea5e9',
  success:  '#10b981',
  warning:  '#f59e0b',
  danger:   '#ef4444',
  bg:       '#0f172a',
  card:     '#1e293b',
  border:   'rgba(255,255,255,0.08)',
  text:     '#f1f5f9',
  textDim:  '#64748b',
  textSub:  '#94a3b8',
};

export const FONTS = {
  regular: Platform.OS === 'ios' ? 'System' : 'Roboto',
  bold:    Platform.OS === 'ios' ? 'System' : 'Roboto',
};

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 };
export const SHADOW = {
  card: { shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:12, elevation:8 },
  glow: (color: string) => ({ shadowColor:color, shadowOffset:{width:0,height:0}, shadowOpacity:0.5, shadowRadius:16, elevation:10 }),
};

import { Platform } from 'react-native';
