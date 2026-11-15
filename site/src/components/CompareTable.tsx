import { ALL_COUNTRIES } from '../data/dataset';
import type { Dataset, Selection } from '../data/dataset';
import { useI18n } from '../i18n/I18nContext';
import type { MapMetric } from '../state/viewState';
import type { ColorScale } from '../viz/colorScale';
import { inkOn } from '../viz/colorScale';

type Props = {
  dataset: Dataset;
  metric: MapMetric;
  year: number;
  selection: Selection;
  scale: ColorScale;
  onSelect: (selection: Selection) => void;
  onYear: (year: number) => void;
};

/**
 * Countries by year for the chosen indicator. Every value is printed; the
 * cell tint repeats the map's colour scale.
 */
export function CompareTable({ dataset, metric, year, selection, scale, onSelect, onYear }: Props) {
  const { t, name, measure } = useI18n();
  return (
    <>
      <p className="note" id="compare-caption">
        {t('compare.caption', { metric: t(`metric.${metric}`) })}
      </p>
      <div className="table-scroll">
        <table className="compare" aria-labelledby="compare-title" aria-describedby="compare-caption">
          <thead>
            <tr>
              <th scope="col">{t('compare.country')}</th>
              {dataset.years.map((column) => (
                <th key={column} scope="col" className={column === year ? 'is-current' : undefined}>
                  <button
                    type="button"
                    aria-pressed={column === year}
                    onClick={() => onYear(column)}
                  >
                    {column}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.countries.map((country) => (
              <tr key={country.iso3} className={country.iso3 === selection ? 'is-selected' : undefined}>
                <th scope="row">
                  <button
                    type="button"
                    aria-pressed={country.iso3 === selection}
                    onClick={() => onSelect(country.iso3)}
                  >
                    {name(country)}
                  </button>
                </th>
                {dataset.years.map((column) => {
                  const value = dataset.countrySummary(country.iso3, column)?.[metric] ?? null;
                  const fill = scale.color(value);
                  return (
                    <td
                      key={column}
                      className={`${fill ? 'is-tinted' : 'is-no-data'}${
                        column === year ? ' is-current' : ''
                      }`}
                      style={fill ? { backgroundColor: fill, color: inkOn(fill) } : undefined}
                    >
                      {measure(metric, value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={selection === ALL_COUNTRIES ? 'is-selected' : undefined}>
              <th scope="row">
                <button
                  type="button"
                  aria-pressed={selection === ALL_COUNTRIES}
                  onClick={() => onSelect(ALL_COUNTRIES)}
                >
                  {t('controls.allCountries')}
                </button>
              </th>
              {dataset.years.map((column) => (
                <td key={column} className={column === year ? 'is-current' : undefined}>
                  {measure(metric, dataset.summary(ALL_COUNTRIES, column)?.[metric])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
