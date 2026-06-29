/**
 * Design tokens for Morning Watering.
 *
 * Elder-first defaults: large type, high contrast, generous spacing, big tap
 * targets. Values lean intentionally bigger than typical mobile UI. See
 * research/ux-structure-benchmark-2026-06-26.md (accessibility section).
 */

export const colors = {
  // Warm, calm morning palette
  sky: '#EAF6FF',
  skyDeep: '#D6ECFF',
  ink: '#1F2A33', // near-black text on light bg -> > 12:1 contrast
  inkSoft: '#3D4D59',
  paper: '#FFFFFF',

  // The plant + water
  leaf: '#3F9D5A',
  leafDeep: '#2E7D45',
  stem: '#4CA866',
  soil: '#7A5A43',
  pot: '#C8763D',
  potDark: '#A85E2C',
  water: '#2D9CDB',
  waterSoft: '#9BD4F5',
  bloom: '#E255A0', // pink bloom

  // Actions / states
  primary: '#1B7F4B', // deep green CTA, white text -> AA+
  primaryPressed: '#14613A',
  danger: '#B23B3B',
  thirsty: '#C99A2E',
  wilt: '#9A937E',
  success: '#1B7F4B',
};

// Type scale — minimums chosen for readability at arm's length for 65+ users.
export const fonts = {
  display: 56,
  h1: 40,
  h2: 30,
  body: 24,
  bodySmall: 20,
  button: 28,
};

export const spacing = {
  xs: 6,
  sm: 12,
  md: 20,
  lg: 32,
  xl: 48,
};

export const radii = {
  md: 16,
  lg: 28,
  pill: 999,
};

// Minimum tap target. Primary actions are even larger (see BigButton).
export const TOUCH_MIN = 64;
