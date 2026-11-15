import { COUNT_FIELDS } from '../data/types';
import type { CountryYearRow, MeasureField, TotalYearRow } from '../data/types';
import { formatCount, formatPercent } from '../i18n/format';
import { useI18n } from '../i18n/I18nContext';
import type { MessageKey } from '../i18n/messages';

const TILES: readonly { field: MeasureField; note?: MessageKey }[] = [
  { field: 'uniform_applied' },
  { field: 'uniform_issued' },
  { field: 'uniform_not_issued' },
  { field: 'not_issued_rate', note: 'metric.note.not_issued_rate' },
  { field: 'mev_issued', note: 'metric.note.mev_issued' },
  { field: 'mev_share', note: 'metric.note.mev_share' },
  { field: 'ltv_issued', note: 'metric.note.ltv_issued' },
];

type Props = {
  row: TotalYearRow | CountryYearRow;
  /** True when the year's source file prints its rate over applications. */
  sourceRateOverApplications: boolean;
};

/** Headline figures of one selection and year, with coverage notes. */
export function StatTiles({ row, sourceRateOverApplications }: Props) {
  const { t, locale, measure } = useI18n();
  const sourceRate = 'not_issued_rate_source' in row ? row.not_issued_rate_source : null;
  const blanks = COUNT_FIELDS.filter((field) => row[`blank_${field}`] > 0);

  return (
    <>
      <dl className="tiles">
        {TILES.map(({ field, note }) => (
          <div key={field} className="tile">
            <dt>{t(`metric.${field}`)}</dt>
            <dd className={row[field] === null ? 'tile-value is-no-data' : 'tile-value'}>
              {measure(field, row[field])}
            </dd>
            {note ? <dd className="tile-note">{t(note)}</dd> : null}
            {field === 'not_issued_rate' && sourceRateOverApplications && sourceRate !== null ? (
              <dd className="tile-note">
                {t('detail.rateSource', {
                  year: row.year,
                  value: formatPercent(sourceRate, locale),
                })}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
      <p className="note">
        {t('detail.coverage', {
          entries: formatCount(row.consulate_entries, locale),
          withApplications: formatCount(row.consulates_with_applications, locale),
          states: formatCount(row.states_listed, locale),
          statesWithApplications: formatCount(row.states_with_applications, locale),
        })}
      </p>
      {blanks.length > 0 ? (
        <div className="note">
          <p>{t('detail.blank.title')}</p>
          <ul>
            {blanks.map((field) => (
              <li key={field}>
                {t('detail.blank.item', {
                  metric: t(`metric.${field}`),
                  blank: formatCount(row[`blank_${field}`], locale),
                  entries: formatCount(row.consulate_entries, locale),
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
