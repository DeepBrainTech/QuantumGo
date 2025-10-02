// Rating-to-rank conversion utilities (OGS-like continuous scale)
// x = ln(r/A) * C, where A=525, C=23.15; 30k maps to x=0
// If x < 30 => (30 - x)k, else => (x - 29)d

const A = 525;
const C = 23.15;

export type RankLabel = 'k' | 'd';

export function ratingToIndex(rating: number): number {
  const r = Math.max(1, rating || 1);
  return Math.log(r / A) * C;
}

export function ratingToContinuousRank(rating: number): { value: number; label: RankLabel } {
  const x = ratingToIndex(rating);
  if (x < 30) {
    return { value: 30 - x, label: 'k' };
  } else {
    return { value: x - 29, label: 'd' };
  }
}

export function rdToRankDelta(rating: number, rd: number): number {
  const r = Math.max(1, rating || 1);
  const dr = Math.max(0, rd || 0);
  return (C / r) * dr;
}

export function formatRatingText(rating: number, rd: number): string {
  return `${Math.round(rating)} ± ${Math.round(rd)}`;
}

export function formatRankText(rating: number, rd: number): string {
  const { value, label } = ratingToContinuousRank(rating);
  const rank = Math.max(0, Math.round(value * 10) / 10);
  const rankDelta = Math.round(rdToRankDelta(rating, rd) * 10) / 10;
  // No uncertainty suffix by default
  return `${rank}${label} ± ${rankDelta}`;
}

export function formatRatingAndRank(rating: number, rd: number): { ratingText: string; rankText: string } {
  return { ratingText: formatRatingText(rating, rd), rankText: formatRankText(rating, rd) };
}

