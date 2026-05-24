import { describe, expect, it } from 'vitest';
import { parseReportYearInput } from '../reportYearInput';

describe('parseReportYearInput', () => {
  it('accepts four-digit calendar years', () => {
    expect(parseReportYearInput('2026')).toBe(2026);
    expect(parseReportYearInput(' 2026 ')).toBe(2026);
  });

  it('rejects exponent notation and partial numeric text', () => {
    expect(parseReportYearInput('2e3')).toBeNull();
    expect(parseReportYearInput('2026abc')).toBeNull();
  });
});
