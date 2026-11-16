import type { Dataset } from '../data/dataset';
import { useI18n } from '../i18n/I18nContext';
import type { MessageKey } from '../i18n/messages';
import { Reveal } from './Reveal';

const DOWNLOADS = [
  'country_year',
  'country_state_year',
  'consulate_year',
  'state_year',
  'total_year',
  'reporting_states',
] as const;

function Paragraphs({ keys }: { keys: readonly MessageKey[] }) {
  const { t } = useI18n();
  return (
    <>
      {keys.map((key) => (
        <p key={key}>{t(key)}</p>
      ))}
    </>
  );
}

/** Sources, definitions, coverage and downloads. */
export function Methodology({ dataset }: { dataset: Dataset }) {
  const { t, name, locale } = useI18n();
  const { meta } = dataset.data;
  const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

  const retrieved = [...new Set(meta.source_files.map((file) => file.retrieved))]
    .map((day) =>
      new Date(`${day}T00:00:00Z`).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    )
    .join(', ');

  // First year in which each State appears on the source sheet.
  const firstYears = new Map<number, string[]>();
  for (const state of dataset.states) {
    const first = Math.min(...state.years);
    firstYears.set(first, [...(firstYears.get(first) ?? []), name(state)]);
  }
  const renamedCities = dataset.data.consulates.filter((city) => city.source_names.length > 1);

  return (
    <Reveal className="method" aria-labelledby="method-title">
      <h2 id="method-title">{t('method.title')}</h2>
      <div className="method-grid">
        <section>
          <h3>{t('method.source.title')}</h3>
          <p>{t('method.source.text', { publisher: meta.publisher, retrieved })}</p>
          <p>
            <a href={meta.source_page} rel="noreferrer">
              {t('method.source.link')}
            </a>
          </p>
        </section>
        <section>
          <h3>{t('method.scope.title')}</h3>
          <Paragraphs
            keys={['method.scope.rows', 'method.scope.location', 'method.scope.criterion']}
          />
        </section>
        <section>
          <h3>{t('method.terms.title')}</h3>
          <ul>
            {(
              [
                'method.terms.applied',
                'method.terms.issued',
                'method.terms.mev',
                'method.terms.ltv',
                'method.terms.notIssued',
                'method.terms.share',
                'method.terms.rate',
              ] as const
            ).map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>{t('method.derived.title')}</h3>
          <Paragraphs keys={['method.derived.sums', 'method.derived.rate2019']} />
        </section>
        <section>
          <h3>{t('method.coverage.title')}</h3>
          <Paragraphs
            keys={['method.coverage.states', 'method.coverage.national', 'method.coverage.other']}
          />
          <p>{t('method.coverage.listed')}</p>
          <ul>
            {[...firstYears.entries()]
              .sort(([a], [b]) => a - b)
              .map(([year, names]) => (
                <li key={year}>
                  {year}: {names.sort((a, b) => a.localeCompare(b, locale)).join(', ')}
                </li>
              ))}
          </ul>
        </section>
        <section>
          <h3>{t('method.missing.title')}</h3>
          <p>{t('method.missing.text')}</p>
          <h3>{t('method.names.title')}</h3>
          <p>{t('method.names.text')}</p>
          <ul>
            {renamedCities.map((city) => (
              <li key={city.consulate_id}>
                {name(city)} — {city.source_names.join(', ')}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>{t('method.checks.title')}</h3>
          <p>{t('method.checks.text')}</p>
          <p>
            <a href={dataUrl('validation_report.json')}>{t('method.checks.link')}</a>
          </p>
          <h3>{t('method.map.title')}</h3>
          <p>{t('method.map.text')}</p>
        </section>
        <section>
          <h3>{t('method.download.title')}</h3>
          <p>{t('method.download.text')}</p>
          <ul>
            {DOWNLOADS.map((file) => (
              <li key={file}>
                <a href={dataUrl(`${file}.csv`)} download>
                  {t(`download.${file}`)}
                </a>
              </li>
            ))}
          </ul>
          <p>{t('method.download.files')}</p>
          <ul className="inline-list">
            {meta.source_files.map((file) => (
              <li key={file.year}>
                <a href={file.url} rel="noreferrer">
                  {file.year}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Reveal>
  );
}
