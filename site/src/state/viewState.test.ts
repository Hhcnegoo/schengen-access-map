import { describe, expect, it } from 'vitest';
import { ALL_COUNTRIES, dataset } from '../data/dataset';
import { DEFAULT_LOCALE, parseViewState, serializeViewState } from './viewState';

describe('view state in the URL hash', () => {
  it('starts in English with the latest year and all countries', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(parseViewState('', dataset)).toEqual({
      locale: 'en',
      year: 2025,
      metric: 'uniform_applied',
      selection: ALL_COUNTRIES,
      view: 'countries',
    });
  });

  it('shows Russian only when the URL asks for it', () => {
    expect(parseViewState('#lang=ru', dataset).locale).toBe('ru');
    expect(parseViewState('#year=2024', dataset).locale).toBe('en');
  });

  it('reads a complete hash', () => {
    expect(
      parseViewState('#lang=ru&year=2021&metric=not_issued_rate&country=KAZ&view=states', dataset),
    ).toEqual({ locale: 'ru', year: 2021, metric: 'not_issued_rate', selection: 'KAZ', view: 'states' });
  });

  it('falls back on values that are not in the data', () => {
    const state = parseViewState('#lang=fr&year=2018&metric=ltv_issued&country=UKR&view=globe', dataset);
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
    expect(parseViewState(serializeViewState(state), dataset)).toEqual(state);
  });
});
