const SQFT_PER_ACRE = 43_560;

/**
 * Land in Myanmar is normally advertised as width x length in feet. Where both
 * are given we derive the area rather than trusting a separately typed number.
 */
export function deriveLandAreaSqft(
  widthFt?: number | null,
  lengthFt?: number | null,
): number | null {
  if (!widthFt || !lengthFt) return null;
  if (widthFt <= 0 || lengthFt <= 0) return null;
  return Math.round(widthFt * lengthFt);
}

export function acresToSqft(acres: number): number {
  return Math.round(acres * SQFT_PER_ACRE);
}

export function sqftToAcres(sqft: number): number {
  return Number((sqft / SQFT_PER_ACRE).toFixed(4));
}
