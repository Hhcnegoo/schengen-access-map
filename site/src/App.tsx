import { useMemo } from 'react';
import { BreakdownTable } from './components/BreakdownTable';
import { CompareTable } from './components/CompareTable';
import { Controls } from './components/Controls';
import { MapLegend } from './components/MapLegend';
import { MapView } from './components/MapView';
import type { MapRegion } from './components/MapView';
import { Methodology } from './components/Methodology';
import { StatTiles } from './components/StatTiles';
import { TrendCharts } from './components/TrendCharts';
import type { Dataset } from './data/dataset';
import { LOCALES } from './i18n/format';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { labelFor } from './map/labels';
import { useColorMode, useMapShapes, useViewState } from './state/hooks';
import { MAP_VIEWS } from './state/viewState';
import type { ViewState } from './state/viewState';
import { buildColorScale } from './viz/colorScale';

type PageProps = {
  dataset: Dataset;
  state: ViewState;
  update: (patch: Partial<ViewState>) => void;
};

function Page({ dataset, state, update }: PageProps) {
  const { t, name, measure } = useI18n();
  const { year, metric, selection, view, locale } = state;
  const mode = useColorMode();
  const shapes = useMapShapes();

  const selectedCountry = dataset.country(selection);
  const selectionName = selectedCountry ? name(selectedCountry) : t('controls.allCountries');
  const metricName = t(`metric.${metric}`);
  const summary = dataset.summary(selection, year);

  // One scale per indicator and level, built from every year it covers.
  const countryScale = useMemo(
    () =>
      buildColorScale(
        metric,
        dataset.data.country_year.map((row) => row[metric]),
        mode,
      ),
    [dataset, metric, mode],
  );
  const stateScale = useMemo(
    () =>
      buildColorScale(
        metric,
        dataset.stateRowsAllYears(selection).map((row) => row[metric]),
        mode,
      ),
    [dataset, metric, selection, mode],
  );

  const regions = useMemo<MapRegion[]>(() => {
    if (view === 'countries') {
      return dataset.countries.map((country) => {
        const value = dataset.countrySummary(country.iso3, year)?.[metric] ?? null;
        return {
          id: country.iso_n3,
          key: country.iso3,
          name: name(country),
          value,
          valueText: measure(metric, value),
          label: labelFor(country.iso3),
        };
      });
    }
    return dataset.stateRows(selection, year).flatMap((row) => {
      const stateInfo = dataset.state(row.schengen_state_iso2);
      if (!stateInfo) return [];
      return {
        id: stateInfo.iso_n3,
        key: stateInfo.iso2,
        name: name(stateInfo),
        value: row[metric],
        valueText: measure(metric, row[metric]),
      };
    });
  }, [dataset, view, selection, year, metric, name, measure]);

  return (
    <>
      <a className="skip-link" href="#main">
        {t('app.skip')}
      </a>
      <header className="site-header">
        <div>
          <h1>{t('app.title')}</h1>
          <p className="subtitle">{t('app.subtitle')}</p>
        </div>
        <div className="segmented" role="group" aria-label={t('lang.label')}>
          {LOCALES.map((option) => (
            <button
              key={option}
              type="button"
              lang={option}
              aria-pressed={option === locale}
              onClick={() => update({ locale: option })}
            >
              {t(`lang.${option}`)}
            </button>
          ))}
        </div>
      </header>

      <main id="main">
        <p className="lead">{t('app.lead')}</p>

        <Controls
          dataset={dataset}
          year={year}
          metric={metric}
          selection={selection}
          onYear={(next) => update({ year: next })}
          onMetric={(next) => update({ metric: next })}
          onSelect={(next) => update({ selection: next })}
        />

        <section className="card" aria-labelledby="map-title">
          <div className="card-head">
            <h2 id="map-title">{t('map.title', { metric: metricName, year })}</h2>
            <div className="control">
              <span className="control-label" id="control-view">
                {t('map.view.label')}
              </span>
              <div className="segmented" role="group" aria-labelledby="control-view">
                {MAP_VIEWS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={option === view}
                    onClick={() => update({ view: option })}
                  >
                    {t(`map.view.${option}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="note">
            {view === 'countries'
              ? t('map.caption.countries')
              : t('map.caption.states', { selection: selectionName })}
          </p>
          {shapes.status === 'ready' ? (
            <MapView
              shapes={shapes.shapes}
              regions={regions}
              scale={view === 'countries' ? countryScale : stateScale}
              selectedId={view === 'countries' ? (selectedCountry?.iso_n3 ?? null) : null}
              contextRegion={
                view === 'states' && selectedCountry
                  ? {
                      id: selectedCountry.iso_n3,
                      name: selectionName,
                      label: labelFor(selectedCountry.iso3),
                    }
                  : null
              }
              ariaLabel={t('map.aria', { metric: metricName, year })}
              tooltipContext={`${metricName}, ${year}`}
              {...(view === 'countries'
                ? {
                    onSelect: (key: string) => update({ selection: key }),
                    selectLabel: (regionName: string) => t('map.select', { name: regionName }),
                  }
                : {})}
            />
          ) : (
            <div className="map-frame is-placeholder" role="status">
              {shapes.status === 'loading' ? t('map.loading') : t('map.error')}
            </div>
          )}
          <MapLegend
            field={metric}
            scale={view === 'countries' ? countryScale : stateScale}
            showNotListed={view === 'states'}
          />
          <p className="note">{t('map.boundaries')}</p>
        </section>

        <section className="card" aria-labelledby="compare-title">
          <h2 id="compare-title">{t('compare.title')}</h2>
          <CompareTable
            dataset={dataset}
            metric={metric}
            year={year}
            selection={selection}
            scale={countryScale}
            onSelect={(next) => update({ selection: next })}
            onYear={(next) => update({ year: next })}
          />
        </section>

        <section className="card" aria-labelledby="detail-title">
          <h2 id="detail-title">{t('detail.title', { selection: selectionName, year })}</h2>
          {summary ? (
            <StatTiles
              row={summary}
              sourceRateOverApplications={
                dataset.data.meta.source_not_issued_rate_denominator[String(year)] ===
                'applications'
              }
            />
          ) : (
            <p className="note">{t('value.noData')}</p>
          )}

          <h3>{t('trend.title', { selection: selectionName })}</h3>
          <TrendCharts rows={dataset.series(selection)} year={year} />

          <BreakdownTable
            dataset={dataset}
            selection={selection}
            selectionName={selectionName}
            year={year}
          />
        </section>

        <Methodology dataset={dataset} />
      </main>

      <footer className="site-footer">
        <p>
          {t('footer.source')}{' '}
          <a href={dataset.data.meta.source_page} rel="noreferrer">
            {t('method.source.link')}
          </a>
        </p>
      </footer>
    </>
  );
}

export function App({ dataset }: { dataset: Dataset }) {
  const [state, update] = useViewState(dataset);
  return (
    <I18nProvider locale={state.locale}>
      <Page dataset={dataset} state={state} update={update} />
    </I18nProvider>
  );
}
