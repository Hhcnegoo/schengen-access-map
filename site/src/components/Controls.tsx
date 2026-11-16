import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ALL_COUNTRIES } from '../data/dataset';
import type { Dataset, Selection } from '../data/dataset';
import { useI18n } from '../i18n/I18nContext';
import { MAP_METRICS } from '../state/viewState';
import type { MapMetric } from '../state/viewState';

/** Time each year stays on screen while the years play. */
const PLAY_STEP_MS = 1700;

type Props = {
  dataset: Dataset;
  year: number;
  metric: MapMetric;
  onYear: (year: number) => void;
  onMetric: (metric: MapMetric) => void;
};

/** One row of filters that scopes everything below it. */
export function Controls({ dataset, year, metric, onYear, onMetric }: Props) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const years = dataset.years;
  const index = years.indexOf(year);
  const setYear = useRef(onYear);
  setYear.current = onYear;

  // While playing, step to the next year and stop at the last one.
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setTimeout(() => {
      const next = years[index + 1];
      if (next === undefined) setPlaying(false);
      else setYear.current(next);
    }, PLAY_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index, years]);

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    const first = years[0];
    if (index === years.length - 1 && first !== undefined) onYear(first);
    setPlaying(true);
  }

  return (
    <section className="toolbar" aria-label={t('controls.label')}>
      <div className="control control-year">
        <span className="control-label" id="control-year">
          {t('controls.year')}
        </span>
        <div className="timeline">
          <button
            type="button"
            className={`play-button${playing ? ' is-playing' : ''}`}
            aria-pressed={playing}
            aria-label={playing ? t('controls.pause') : t('controls.play')}
            title={playing ? t('controls.pause') : t('controls.play')}
            onClick={togglePlay}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              {playing ? <path d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z" /> : <path d="M5 2.8v10.4L13 8z" />}
            </svg>
          </button>
          <div
            className="timeline-track"
            role="group"
            aria-labelledby="control-year"
            style={{ '--index': index, '--count': years.length } as CSSProperties}
          >
            <span className="timeline-thumb" aria-hidden="true" />
            {years.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === year}
                onClick={() => {
                  setPlaying(false);
                  onYear(option);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="control control-metric">
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
    </section>
  );
}

type CountrySelectProps = {
  dataset: Dataset;
  selection: Selection;
  onSelect: (selection: Selection) => void;
};

/** Country whose consulates are shown, or all seven combined. */
export function CountrySelect({ dataset, selection, onSelect }: CountrySelectProps) {
  const { t, name } = useI18n();
  return (
    <div className="control">
      <label className="control-label" htmlFor="control-country">
        {t('controls.country')}
      </label>
      <div className="select">
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
    </div>
  );
}
