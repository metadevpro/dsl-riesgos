import {
  formatSignificantPercent,
  getSignificantDigitCount,
  formatProbabilityPercent,
  normalizeProbability,
} from './probability.utils';

describe('getSignificantDigitCount', () => {
  it('counts the digits a value genuinely carries', () => {
    expect(getSignificantDigitCount(0.5)).toBe(1);
    expect(getSignificantDigitCount(0.25)).toBe(2);
    expect(getSignificantDigitCount(0)).toBe(0);
  });
});

describe('formatSignificantPercent', () => {
  it('strips trailing zeros — no fake decimals', () => {
    expect(formatSignificantPercent(0.5)).toBe('50');
    expect(formatSignificantPercent(0.25)).toBe('25');
    expect(formatSignificantPercent(1)).toBe('100');
    expect(formatSignificantPercent(0)).toBe('0');
  });

  it('prefers 2 decimals for readability — cuts the meaningless tail', () => {
    expect(formatSignificantPercent(0.1023459872)).toBe('10.23');
    expect(formatSignificantPercent(0.123456)).toBe('12.35');
  });

  it('reveals real precision when 2 decimals would collapse a non-zero value to 0', () => {
    expect(formatSignificantPercent(0.000000123)).toBe('0.0000123');
  });

  it('rounds floating-point noise in tiny values to significant figures', () => {
    expect(formatSignificantPercent(0.0000299991)).toBe('0.003');
  });

  it('never exceeds the 8-decimal cap', () => {
    const out = formatSignificantPercent(0.0000000001);
    const decimals = out.includes('.') ? out.split('.')[1].length : 0;
    expect(decimals).toBeLessThanOrEqual(8);
  });

  it('returns "0" for non-finite input', () => {
    expect(formatSignificantPercent(NaN)).toBe('0');
    expect(formatSignificantPercent(Infinity)).toBe('0');
  });
});

describe('normalizeProbability', () => {
  it('rounds to 6 decimals by default (unchanged)', () => {
    expect(normalizeProbability(0.1234567, 1)).toBe(0.123457);
  });
  it('keeps full precision when decimals=null', () => {
    expect(normalizeProbability(0.1234567, 1, null)).toBe(0.1234567);
  });
  it('clamps to the given max', () => {
    expect(normalizeProbability(5, 1, null)).toBe(1);
  });
});

describe('formatProbabilityPercent (0..100 scale)', () => {
  it('formats through the shared rule with a % suffix', () => {
    expect(formatProbabilityPercent(50)).toBe('50%');
    expect(formatProbabilityPercent(10.23459872)).toBe('10.23%');
    expect(formatProbabilityPercent(0)).toBe('0%');
  });
});
