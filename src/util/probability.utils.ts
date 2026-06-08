export const PROBABILITY_KEY = 'probability';
export const MAX_PROBABILITY = 100;
export const MAX_DISPLAY_DECIMALS = 8;

const LOG10 = Math.log(10);

/**
 * Counts how many significant digits a number genuinely carries.
 * Used as an upper bound so display never invents decimals the value doesn't have
 * (e.g. 0.5 has 1 → renders "50", not "50.00").
 */
export function getSignificantDigitCount(n: number): number {
  // remove decimal and make positive
  const s = String(n).replace('.', '');
  let num = Number(s);
  if (isNaN(num) || num === 0) return 0;
  num = Math.abs(num);
  // kill the 0s at the end of num
  while (num !== 0 && num % 10 === 0) num /= 10;
  // get number of digits
  return Math.floor(Math.log(num) / LOG10) + 1;
}

/**
 * Formats a 0..1 fraction as a percent string (no `%` suffix — callers add it).
 * Prefers `preferredDecimals` for readability, but reveals the value's real precision
 * (capped at `maxDecimals`) when rounding would collapse a non-zero value to 0.
 * Trailing zeros are stripped.
 */
export function formatSignificantPercent(
  fraction: number,
  preferredDecimals = 2,
  maxDecimals = MAX_DISPLAY_DECIMALS
): string {
  if (!Number.isFinite(fraction)) return '0';
  const percent = fraction * 100;
  // Upper bound: never invent decimals the value doesn't carry. getSignificantDigitCount
  // can misbehave on very small (exponential-form) numbers, so clamp it to [0, maxDecimals].
  const precisionCap = Math.min(maxDecimals, Math.max(0, getSignificantDigitCount(fraction)));
  // Default to the readable precision...
  let decimals = Math.min(preferredDecimals, precisionCap);
  // ...but if a non-zero value would collapse to 0, reveal more precision —
  // rounded to a few significant figures so floating-point tails
  // (e.g. 0.00299991) print as 0.003, not the raw noisy decimal.
  if (percent !== 0 && Number(percent.toFixed(decimals)) === 0) {
    const significantFigures = preferredDecimals + 1; // 3 by default
    const firstSignificantExponent = Math.floor(Math.log10(Math.abs(percent)));
    decimals = significantFigures - 1 - firstSignificantExponent;
  }
  decimals = Math.min(maxDecimals, Math.max(0, decimals)); // clamp keeps the 8-decimal cap

  const fixed = percent.toFixed(decimals);
  // Strip trailing zeros (and a dangling dot) without an exponential round-trip.
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

function normalizeNumericInput(rawValue: string): string {
  const compact = rawValue.replace(/\s+/g, '');
  const hasComma = compact.includes(',');
  const hasDot = compact.includes('.');

  if (hasComma && hasDot) {
    const lastComma = compact.lastIndexOf(',');
    const lastDot = compact.lastIndexOf('.');

    if (lastComma > lastDot) {
      // Supports locales like "1.234,56".
      return compact.replace(/\./g, '').replace(',', '.');
    }

    // Supports locales like "1,234.56".
    return compact.replace(/,/g, '');
  }

  if (hasComma) {
    // Supports decimal comma values like "0,5".
    return compact.replace(',', '.');
  }

  return compact;
}

function parseProbabilityNumber(rawValue: unknown): number | null {
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? rawValue : null;
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }

    const normalizedInput = normalizeNumericInput(trimmed);
    const numericValue = Number(normalizedInput);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function normalizeProbability(
  rawValue: unknown,
  maxProbability: number = MAX_PROBABILITY,
  decimals: number | null = 6
): number | null {
  const numericValue = parseProbabilityNumber(rawValue);
  if (numericValue == null || numericValue < 0) {
    return null;
  }

  const clamped = Math.max(0, Math.min(maxProbability, numericValue));

  return decimals == null ? clamped : Number(clamped.toFixed(decimals));
}

export function formatProbabilityPercent(rawValue: unknown, maxProbability: number = MAX_PROBABILITY): string {
  const normalized = normalizeProbability(rawValue, maxProbability) ?? 0;
  return `${formatSignificantPercent(normalized / maxProbability)}%`;
}
