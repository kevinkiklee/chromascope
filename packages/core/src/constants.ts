/** Fraction of canvas half-size used as the maximum radius, leaving room for labels. */
export const RADIUS_FACTOR = 0.45;

/** Base half-width for a harmony zone in radians (15 degrees). */
export const HARMONY_BASE_HALF_WIDTH = Math.PI / 12;

/** Industry-standard skin tone line angle in radians. */
export const SKIN_TONE_ANGLE_RAD = (123 * Math.PI) / 180;

export const TWO_PI = 2 * Math.PI;

/** Zone fill colors (semi-transparent) for harmony overlay rendering. */
export const ZONE_FILL_COLORS = [
  "rgba(255, 200, 50, 0.15)",
  "rgba(50, 200, 255, 0.15)",
  "rgba(255, 100, 200, 0.15)",
  "rgba(100, 255, 150, 0.15)",
] as const;

/** Zone border colors for harmony overlay rendering. */
export const ZONE_BORDER_COLORS = [
  "rgba(255, 200, 50, 0.6)",
  "rgba(50, 200, 255, 0.6)",
  "rgba(255, 100, 200, 0.6)",
  "rgba(100, 255, 150, 0.6)",
] as const;
