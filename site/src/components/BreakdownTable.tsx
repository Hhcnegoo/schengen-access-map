import { useMemo, useState } from 'react';
import { ALL_COUNTRIES } from '../data/dataset';
import type { Dataset, Selection } from '../data/dataset';
import type { MeasureField, Measures } from '../data/types';
import { formatCount } from '../i18n/format';
import { useI18n } from '../i18n/I18nContext';
import type { MessageKey } from '../i18n/messages';

const MEASURE_COLUMNS: readonly MeasureField[] = [
  'uniform_applied',
  'uniform_issued',
  'mev_issued',
  'mev_share',
  'ltv_issued',
  'uniform_not_issued',
  'not_issued_rate',
];

type Tab = 'states' | 'consulates';
type TextColumn = 'country' | 'state' | 'city';
type SortKey = TextColumn | MeasureField | 'entries';
type Sort = { key: SortKey; descending: boolean };

type TableRow = {
  id: string;
  country: string;
  state: string;
  city: string;
  entries: number | null;
  measures: Measures;
};

type Props = {
  dataset: Dataset;
  selection: Selection;
  selectionName: string;
  year: number;
};

const TEXT_COLUMN_LABEL: Record<TextColumn, MessageKey> = {
  country: 'states.column.country',
  state: 'states.column.state',
  city: 'states.column.city',
};

function isTextColumn(key: SortKey): key is TextColumn {
  return key === 'country' || key === 'state' || key === 'city';
}

/** Order rows by one column; missing values always come last. */
export function sortRows(rows: TableRow[], sort: Sort, locale: string): TableRow[] {
  const direction = sort.descending ? -1 : 1;
  const key = sort.key;
  return [...rows].sort((a, b) => {
    if (isTextColumn(key)) return direction * a[key].localeCompare(b[key], locale);
    const left = key === 'entries' ? a.entries : a.measures[key];
    const right = key === 'entries' ? b.entries : b.measures[key];
    if (left === null && right === null) return a.state.localeCompare(b.state, locale);
    if (left === null) return 1;
    if (right === null) return -1;
    return direction * (left - right) || a.state.localeCompare(b.state, locale);
  });
}

/** Figures of one selection and year by Schengen State or by consulate. */
export function BreakdownTable({ dataset, selection, selectionName, year }: Props) {
  const { t, name, measure, locale } = useI18n();
  const [tab, setTab] = useState<Tab>('states');
  const [sort, setSort] = useState<Sort>({ key: 'uniform_applied', descending: true });

  const rows = useMemo<TableRow[]>(() => {
    const stateName = (iso2: string) => {
      const state = dataset.state(iso2);
      return state ? name(state) : iso2;
    };
    if (tab === 'states') {
      return dataset.stateRows(selection, year).map((row) => ({
        id: row.schengen_state_iso2,
        country: '',
        state: stateName(row.schengen_state_iso2),
        city: '',
        entries: row.consulate_entries,
        measures: row,
      }));
    }
    return dataset.consulateRows(selection, year).map((row) => {
      const country = dataset.country(row.country_iso3);
      const city = dataset.city(row.consulate_id);
      return {
        id: `${row.country_iso3}-${row.schengen_state_iso2}-${row.consulate_id}`,
        country: country ? name(country) : row.country_iso3,
        state: stateName(row.schengen_state_iso2),
        city: city ? name(city) : row.consulate_source_name,
        entries: null,
        measures: row,
      };
    });
  }, [dataset, selection, year, tab, name]);

  const sorted = useMemo(() => sortRows(rows, sort, locale), [rows, sort, locale]);
  // Longest bar = largest value in the table; bars only repeat printed values.
  const longest = Math.max(1, ...rows.map((row) => row.measures.uniform_applied ?? 0));

  const textColumns: TextColumn[] =
    tab === 'states'
      ? ['state']
      : selection === ALL_COUNTRIES
        ? ['country', 'state', 'city']
        : ['state', 'city'];

  function header(key: SortKey, label: string, numeric: boolean) {
    const active = sort.key === key;
    const ariaSort = active ? (sort.descending ? 'descending' : 'ascending') : 'none';
    return (
      <th key={key} scope="col" aria-sort={ariaSort} className={numeric ? 'is-number' : undefined}>
        <button
          type="button"
          title={t('states.sort', { column: label })}
          onClick={() =>
            setSort({ key, descending: active ? !sort.descending : !isTextColumn(key) })
          }
        >
          {label}
          <span aria-hidden="true" className="sort-mark">
            {active ? (sort.descending ? '↓' : '↑') : ''}
          </span>
        </button>
      </th>
    );
  }

  return (
    <div className="breakdown">
      <div className="breakdown-head">
        <h3>{t(tab === 'states' ? 'states.title.states' : 'states.title.consulates', { year })}</h3>
        <div className="segmented" role="group" aria-label={t('states.tab.label')}>
          {(['states', 'consulates'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={tab === option}
              onClick={() => setTab(option)}
            >
              {t(`states.tab.${option}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="note" id="breakdown-caption">
        {t('states.caption', { selection: selectionName })}
      </p>
      <div className="table-scroll">
        <table className="data-table" aria-describedby="breakdown-caption">
          <thead>
            <tr>
              {textColumns.map((column) => header(column, t(TEXT_COLUMN_LABEL[column]), false))}
              {MEASURE_COLUMNS.map((field) => header(field, t(`metric.short.${field}`), true))}
              {tab === 'states' ? header('entries', t('states.column.entries'), true) : null}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id}>
                {textColumns.map((column, index) =>
                  index === 0 ? (
                    <th key={column} scope="row">
                      {row[column]}
                    </th>
                  ) : (
                    <td key={column}>{row[column]}</td>
                  ),
                )}
                {MEASURE_COLUMNS.map((field) => {
                  const value = row.measures[field];
                  return (
                    <td key={field} className={value === null ? 'is-number is-no-data' : 'is-number'}>
                      {measure(field, value)}
                      {field === 'uniform_applied' && value !== null ? (
                        <span
                          className="cell-bar"
                          aria-hidden="true"
                          style={{ width: `${(value / longest) * 100}%` }}
                        />
                      ) : null}
                    </td>
                  );
                })}
                {tab === 'states' ? (
                  <td className="is-number">
                    {row.entries === null ? '' : formatCount(row.entries, locale)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
