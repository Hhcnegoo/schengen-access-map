import { describe, expect, it } from 'vitest';
import { ALL_COUNTRIES, dataset } from '../data/dataset';
import { defaultLocale, parseViewState, serializeViewState } from './viewState';

describe('view state in the URL hash', () => {
  it('starts from the latest year, all countries and the browser language', () => {
    expect(parseViewState('', dataset, ['de-DE', 'en'])).toEqual({
      locale: 'en',
      year: 2025,
      metric: 'uniform_applied',
      selection: ALL_COUNTRIES,
      view: 'countries',
    });
    expect(parseViewState('', dataset, ['ru-RU']).locale).toBe('ru');
  });

  it('reads a complete hash', () => {
    expect(
      parseViewState('#lang=ru&year=2021&metric=not_issued_rate&country=KAZ&view=states', dataset, []),
    ).toEqual({ locale: 'ru', year: 2021, metric: 'not_issued_rate', selection: 'KAZ', view: 'states' });
  });

  it('falls back on values that are not in the data', () => {
    const state = parseViewState('#lang=fr&year=2018&metric=ltv_issued&country=UKR&view=globe', dataset, []);
    expect(state).toEqual({
      locale: 'en',
      year: 2025,
      metric: 'uniform_applied',
      selection: ALL_COUNTRIES,
      view: 'countries',
    });
  });

  it('round-trips through the hash', () => {
    const state = { locale: 'ru', year: 2022, metric: 'mev_share', selection: 'ARM', view: 'states' } as const;
    expect(parseViewState(serializeViewState(state), dataset, [])).toEqual(state);
  });

  it('chooses Russian only for Russian browser languages', () => {
    expect(defaultLocale(['ru'])).toBe('ru');
    expect(defaultLocale(['uk-UA', 'en-US'])).toBe('en');
    expect(defaultLocale([])).toBe('en');
  });
});
