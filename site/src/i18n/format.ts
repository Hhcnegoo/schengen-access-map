import { RATIO_FIELDS } from '../data/types';
import type { MeasureField } from '../data/types';

export const LOCALES = ['en', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

const LANGUAGE_TAG: Record<Locale, string> = { en: 'en-US', ru: 'ru-RU' };

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: Locale, name: string, options: Intl.NumberFormatOptions) {
  const key = `${locale}|${name}`;
  let found = formatters.get(key);
  if (!found) {
    found = new Intl.NumberFormat(LANGUAGE_TAG[locale], options);
    formatters.set(key, found);
  }
  return found;
}

export function isRatioField(field: MeasureField): boolean {
  return (RATIO_FIELDS as readonly string[]).includes(field);
}

/** Whole number with locale grouping, e.g. 645,722 or 645 722. */
export function formatCount(value: number, locale: Locale): string {
  return formatter(locale, 'count', { maximumFractionDigits: 0 }).format(value);
}

/** Ratio as a percentage with one decimal, e.g. 9.7% or 9,7 %. */
export function formatPercent(value: number, locale: Locale): string {
  return formatter(locale, 'percent', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** Short axis label, e.g. 1.2M or 1,2 млн. */
export function formatCompact(value: number, locale: Locale): string {
  return formatter(locale, 'compact', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/** Axis label for a ratio, e.g. 20% or 2.5%. */
export function formatPercentAxis(value: number, locale: Locale): string {
  return formatter(locale, 'percent-axis', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format a measure for display. Returns `null` for a missing value so that
 * the caller renders the "no data" label instead of a number.
 */
export function formatMeasure(
  field: MeasureField,
  value: number | null | undefined,
  locale: Locale,
): string | null {
  if (value === null || value === undefined) return null;
  return isRatioField(field) ? formatPercent(value, locale) : formatCount(value, locale);
}

export function formatAxis(field: MeasureField, value: number, locale: Locale): string {
  return isRatioField(field) ? formatPercentAxis(value, locale) : formatCompact(value, locale);
}
