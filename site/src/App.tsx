import { useMemo, useState } from 'react';
import { BreakdownTable } from './components/BreakdownTable';
import { CompareTable } from './components/CompareTable';
import { Controls, CountrySelect } from './components/Controls';
import { Globe } from './components/Globe';
import type { GlobeRegion } from './components/Globe';
import { InfoPanel } from './components/InfoPanel';
import type { InfoRow } from './components/InfoPanel';
import { MapLegend } from './components/MapLegend';
import { Methodology } from './components/Methodology';
import { Reveal } from './components/Reveal';
import { StatTiles } from './components/StatTiles';
import { TrendCharts } from './components/TrendCharts';
import { ALL_COUNTRIES } from './data/dataset';
import type { Dataset } from './data/dataset';
import type { MeasureField, Measures } from './data/types';
import { LOCALES, formatCount } from './i18n/format';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { HOME_CENTRE, labelFor } from './map/labels';
import { useAtlas, useColorMode, useViewState } from './state/hooks';
import { MAP_VIEWS } from './state/viewState';
import type { ViewState } from './state/viewState';
import { buildColorScale } from './viz/colorScale';

/** Figures listed for the country chosen on the globe, in reading order. */
const INFO_FIELDS: readonly MeasureField[] = [
  'uniform_applied',
  'uniform_issued',
  'uniform_not_issued',
  'not_issued_rate',
  'mev_issued',
  'mev_share',
  'ltv_issued',
];

type PageProps = {
  dataset: Dataset;
  state: ViewState;
  update: (patch: Partial<ViewState>) => void;
};

function Page({ dataset, state, update }: PageProps) {
  const { t, name, measure } = useI18n();
  const { year, metric, selection, view, locale } = state;
  const mode = useColorMode();
  const atlas = useAtlas();
  // Schengen State chosen on the globe in the "Schengen States" view.
  const [pickedState, setPickedState] = useState<string | null>(null);

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

  const regions = useMemo<GlobeRegion[]>(() => {
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

  const picked = view === 'states' && pickedState ? dataset.state(pickedState) : undefined;
  const pickedRow = picked
    ? dataset.stateRows(selection, year).find((row) => row.schengen_state_iso2 === picked.iso2)
    : undefined;
  const infoRows = (row: Measures): InfoRow[] =>
    INFO_FIELDS.map((field) => ({
      label: t(`metric.${field}`),
      value: measure(field, row[field]),
      missing: row[field] === null,
      active: field === metric,
    }));
  const detailsLink = (
    <p className="info-more">
      <a href="#detail-title">{t('map.info.details')}</a>
    </p>
  );
  // The card beside the globe: the chosen country or State, or the seven
  // countries combined while nothing is chosen.
  const info =
    view === 'states'
      ? picked
        ? {
            overline: t('info.overline.states'),
            title: t('map.info.title', { name: name(picked), year }),
            subtitle: t('map.info.located', { selection: selectionName }),
            rows: pickedRow
              ? [
                  ...infoRows(pickedRow),
                  {
                    label: t('states.column.entries'),
                    value: formatCount(pickedRow.consulate_entries, locale),
                    missing: false,
                  },
                ]
              : [],
            message: pickedRow ? undefined : t('map.info.notListed'),
            onClose: () => setPickedState(null),
          }
        : {
            overline: t('info.overline.states'),
            title: null,
            subtitle: t('map.info.located', { selection: selectionName }),
            rows: [],
          }
      : {
          title: t('map.info.title', { name: selectionName, year }),
          rows: summary ? infoRows(summary) : [],
          footer: detailsLink,
          onClose: selectedCountry ? () => update({ selection: ALL_COUNTRIES }) : undefined,
        };

  return (
    <>
      <a className="skip-link" href="#main">
        {t('app.skip')}
      </a>
      <div className="backdrop" aria-hidden="true" />
      <header className="topbar">
        <p className="overline brand">{t('app.overline')}</p>
        <div className="segmented is-compact" role="group" aria-label={t('lang.label')}>
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

      <main id="main" className="page">
        <div className="intro">
          <h1>{t('app.title')}</h1>
          <p className="subtitle">{t('app.subtitle')}</p>
          <p className="lead">{t('app.lead')}</p>
        </div>

        <Controls
          dataset={dataset}
          year={year}
          metric={metric}
          onYear={(next) => update({ year: next })}
          onMetric={(next) => update({ metric: next })}
        />

        <section className="stage" aria-labelledby="map-title">
          <div className="stage-head">
            <h2 id="map-title">{t('map.title', { metric: metricName, year })}</h2>
            <p className="note">
              {view === 'countries'
                ? t('map.caption.countries')
                : t('map.caption.states', { selection: selectionName })}
            </p>
          </div>
          {atlas.status === 'ready' ? (
            <Globe
              atlas={atlas.atlas}
              regions={regions}
              scale={view === 'countries' ? countryScale : stateScale}
              mode={mode}
              selectedId={
                view === 'countries' ? (selectedCountry?.iso_n3 ?? null) : (picked?.iso_n3 ?? null)
              }
              contextRegion={
                view === 'states' && selectedCountry
                  ? {
                      id: selectedCountry.iso_n3,
                      name: selectionName,
                      label: labelFor(selectedCountry.iso3),
                    }
                  : null
              }
              home={HOME_CENTRE[view]}
              ariaLabel={t('map.aria', { metric: metricName, year })}
              tooltipContext={`${metricName}, ${year}`}
              text={{
                zoomIn: t('map.zoomIn'),
                zoomOut: t('map.zoomOut'),
                reset: t('map.reset'),
                select: (regionName) => t('map.select', { name: regionName }),
              }}
              onSelect={(key) =>
                view === 'countries' ? update({ selection: key }) : setPickedState(key)
              }
            />
          ) : (
            <div className="globe-frame is-placeholder" role="status">
              {atlas.status === 'loading' ? t('map.loading') : t('map.error')}
            </div>
          )}
          <div className="stage-dock">
            <div className="segmented is-compact" role="group" aria-label={t('map.view.label')}>
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
            <MapLegend
              field={metric}
              scale={view === 'countries' ? countryScale : stateScale}
              showNotListed={view === 'states'}
            />
          </div>
          <p className="note is-fine">{t('map.boundaries')}</p>
        </section>

        <InfoPanel
          {...info}
          control={
            <CountrySelect
              dataset={dataset}
              selection={selection}
              onSelect={(next) => update({ selection: next })}
            />
          }
          hint={t('map.hint')}
          closeLabel={t('info.close')}
        />

        <Reveal className="card" aria-labelledby="compare-title">
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
        </Reveal>

        <Reveal className="card" aria-labelledby="detail-title">
          <h2 id="detail-title">{t('detail.title', { selection: selectionName, year })}</h2>
          {summary ? (
            <StatTiles
              row={summary}
              metric={metric}
              animationKey={`${selection}|${year}`}
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
        </Reveal>

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
