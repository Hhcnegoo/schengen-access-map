import { ALL_COUNTRIES } from '../data/dataset';
import type { Dataset, Selection } from '../data/dataset';
import { useI18n } from '../i18n/I18nContext';
import { MAP_METRICS } from '../state/viewState';
import type { MapMetric } from '../state/viewState';

type Props = {
  dataset: Dataset;
  year: number;
  metric: MapMetric;
  selection: Selection;
  onYear: (year: number) => void;
  onMetric: (metric: MapMetric) => void;
  onSelect: (selection: Selection) => void;
};

/** One row of filters that scopes everything below it. */
export function Controls({ dataset, year, metric, selection, onYear, onMetric, onSelect }: Props) {
  const { t, name } = useI18n();
  return (
    <section className="controls" aria-label={t('controls.label')}>
      <div className="control">
        <span className="control-label" id="control-year">
          {t('controls.year')}
        </span>
        <div className="segmented" role="group" aria-labelledby="control-year">
          {dataset.years.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === year}
              onClick={() => onYear(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="control">
        <span className="control-label" id="control-metric">
          {t('controls.metric')}
        </span>
        <div className="segmented" role="group" aria-labelledby="control-metric">
          {MAP_METRICS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === metric}
              onClick={() => onMetric(option)}
            >
              {t(`metric.${option}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="control">
        <label className="control-label" htmlFor="control-country">
          {t('controls.country')}
        </label>
        <select
          id="control-country"
          value={selection}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value={ALL_COUNTRIES}>{t('controls.allCountries')}</option>
          {dataset.countries.map((country) => (
            <option key={country.iso3} value={country.iso3}>
              {name(country)}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
