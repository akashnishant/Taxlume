/**
 * Techabanca visual-system colors used by JavaScript-rendered charts and SVGs.
 * Keep these aligned with the Tailwind overrides in src/index.css.
 */
export const brandColors = {
  ink: "#081014",
  inkSoft: "#102023",
  panel: "#101b20",
  border: "#dce8de",
  textMuted: "#536b65",
  paper: "#eef4f1",
  lime: "#baf16d",
  limeSoft: "#d3fb9d",
  green: "#638c3e",
  greenMid: "#568265",
  greenDeep: "#315340",
  sage: "#93c576",
  warning: "#d6a84b",
  warningStrong: "#bd8e32",
  danger: "#ef6873",
  dangerStrong: "#b73743",
} as const;

export const chartColors = {
  grid: brandColors.border,
  axis: brandColors.textMuted,
  sales: brandColors.greenDeep,
  collections: brandColors.green,
  secondary: brandColors.greenMid,
  tertiary: brandColors.sage,
  warning: brandColors.warning,
  warningStrong: brandColors.warningStrong,
  danger: brandColors.danger,
  dangerStrong: brandColors.dangerStrong,
  muted: "#6b8171",
  white: "#ffffff",
} as const;
