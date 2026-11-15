import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { MeasureField } from '../data/types';
import { formatMeasure } from './format';
import type { Locale } from './format';
import { MESSAGES, fillTemplate } from './messages';
import type { MessageKey } from './messages';

export type I18n = {
  locale: Locale;
  /** Translate a message key, filling `{name}` placeholders. */
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  /** Pick the display name of a country, State or city for the locale. */
  name: (item: { name_en: string; name_ru: string }) => string;
  /** Format a measure, or return the "no data" label for a missing value. */
  measure: (field: MeasureField, value: number | null | undefined) => string;
};

export function createI18n(locale: Locale): I18n {
  const t: I18n['t'] = (key, params) => fillTemplate(MESSAGES[locale][key], params);
  return {
    locale,
    t,
    name: (item) => (locale === 'ru' ? item.name_ru : item.name_en),
    measure: (field, value) => formatMeasure(field, value, locale) ?? t('value.noData'),
  };
}

const I18nContext = createContext<I18n>(createI18n('en'));

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => createI18n(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
