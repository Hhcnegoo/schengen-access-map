import { ALL_COUNTRIES } from '../data/dataset';
import type { Dataset, Selection } from '../data/dataset';
import type { MeasureField } from '../data/types';
import { LOCALES } from '../i18n/format';
import type { Locale } from '../i18n/format';

/** Indicators offered for the map and the comparison table. */
export const MAP_METRICS = [
  'uniform_applied',
  'uniform_issued',
  'mev_share',
  'not_issued_rate',
] as const satisfies readonly MeasureField[];
export type MapMetric = (typeof MAP_METRICS)[number];

export const MAP_VIEWS = ['countries', 'states'] as const;
export type MapView = (typeof MAP_VIEWS)[number];

export type ViewState = {
  locale: Locale;
  year: number;
  metric: MapMetric;
  selection: Selection;
  view: MapView;
};

function oneOf<T extends string>(value: string | null, options: readonly T[]): T | undefined {
  return options.find((option) => option === value);
}

/** Language shown unless the URL asks for another one. */
export const DEFAULT_LOCALE: Locale = 'en';

/** Read the view state from a URL hash such as `#lang=ru&year=2024`. */
export function parseViewState(hash: string, dataset: Dataset): ViewState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const year = Number(params.get('year'));
  const selection = params.get('country') ?? '';
  return {
    locale: oneOf(params.get('lang'), LOCALES) ?? DEFAULT_LOCALE,
    year: dataset.years.includes(year) ? year : Math.max(...dataset.years),
    metric: oneOf(params.get('metric'), MAP_METRICS) ?? 'uniform_applied',
    selection: dataset.isCountry(selection) ? selection : ALL_COUNTRIES,
    view: oneOf(params.get('view'), MAP_VIEWS) ?? 'countries',
  };
}

export function serializeViewState(state: ViewState): string {
  const params = new URLSearchParams({
    lang: state.locale,
    year: String(state.year),
    metric: state.metric,
    country: state.selection,
    view: state.view,
  });
  return `#${params.toString()}`;
}
