export const PROBABILITY_KEY = 'probability';
export const MAX_PROBABILITY = 1.0;

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

export function normalizeProbability(rawValue: unknown, maxProbability: number = MAX_PROBABILITY): number | null {
  const numericValue = parseProbabilityNumber(rawValue);
  if (numericValue == null || numericValue < 0) {
    return null;
  }

  const normalized = numericValue > maxProbability ? numericValue / 100 : numericValue;
  const clamped = Math.max(0, Math.min(maxProbability, normalized));

  return Number(clamped.toFixed(6));
}

export function formatProbabilityPercent(rawValue: unknown, maxProbability: number = MAX_PROBABILITY): string {
  const normalized = normalizeProbability(rawValue, maxProbability) ?? 0;
  const percentage = normalized * 100;

  return Number.isInteger(percentage) ? `${percentage}%` : `${percentage.toFixed(2)}%`;
}
