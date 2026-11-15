import { describe, expect, it } from 'vitest';
import { formatAxis, formatCount, formatMeasure, formatPercent } from './format';
import { createI18n } from './I18nContext';

// Russian formats use no-break spaces; compare with ordinary spaces.
const plain = (text: string | null) => text?.replace(/[  ]/g, ' ');

describe('number formats', () => {
  it('group thousands by locale', () => {
    expect(formatCount(645722, 'en')).toBe('645,722');
    expect(plain(formatCount(645722, 'ru'))).toBe('645 722');
  });

  it('show ratios as percentages with one decimal', () => {
    expect(formatPercent(0.097424, 'en')).toBe('9.7%');
    expect(plain(formatPercent(0.097424, 'ru'))).toBe('9,7 %');
    expect(formatPercent(0, 'en')).toBe('0.0%');
  });

  it('shorten axis labels', () => {
    expect(formatAxis('uniform_applied', 1500000, 'en')).toBe('1.5M');
    expect(formatAxis('uniform_applied', 20000, 'en')).toBe('20K');
    expect(formatAxis('not_issued_rate', 0.025, 'en')).toBe('2.5%');
  });
});

describe('missing values', () => {
  it('are never formatted as a number', () => {
    expect(formatMeasure('ltv_issued', null, 'en')).toBeNull();
    expect(formatMeasure('not_issued_rate', undefined, 'ru')).toBeNull();
  });

  it('are shown with the "no data" label in each language', () => {
    expect(createI18n('en').measure('ltv_issued', null)).toBe('no data');
    expect(createI18n('ru').measure('ltv_issued', null)).toBe('нет данных');
  });

  it('are distinct from a reported zero', () => {
    expect(createI18n('en').measure('ltv_issued', 0)).toBe('0');
    expect(createI18n('en').measure('not_issued_rate', 0)).toBe('0.0%');
  });
});
