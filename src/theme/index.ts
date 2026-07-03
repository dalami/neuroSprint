// Paleta oscura minimalista (según el brief: fondo oscuro, mucho espacio, nada infantil)

export const colors = {
  bg: '#0D1117',
  surface: '#161B22',
  border: '#30363D',
  text: '#E6EDF3',
  textMuted: '#8B949E',
  primary: '#3FB6A8',
  primaryText: '#04211E',
  danger: '#F85149',
  success: '#2EA043',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  pill: 999,
} as const;
