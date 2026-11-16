import { scaleLinear } from 'd3-scale';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CountryYearRow, MeasureField, TotalYearRow } from '../data/types';
import { COUNT_FIELDS, RATIO_FIELDS } from '../data/types';
import { formatAxis } from '../i18n/format';
import { useI18n } from '../i18n/I18nContext';

type Row = TotalYearRow | CountryYearRow;

/** Indicators drawn as small multiples, in reading order. */
const CHART_FIELDS: readonly MeasureField[] = [
  'uniform_applied',
  'uniform_issued',
  'uniform_not_issued',
  'not_issued_rate',
  'mev_issued',
  'mev_share',
];

const TABLE_FIELDS: readonly MeasureField[] = [...COUNT_FIELDS, ...RATIO_FIELDS];

type Props = {
  rows: Row[];
  year: number;
};

type TooltipProps = {
  active?: boolean;
  payload?: readonly { payload?: Row }[];
};

type DotLabelProps = { viewBox?: { x?: number; y?: number; width?: number } };

/** Round axis ends and tick values for one chart; drawing only. */
export function axisFor(field: MeasureField, rows: Row[]): { domain: [number, number]; ticks: number[] } {
  if (field === 'mev_share') return { domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] };
  const top = Math.max(0, ...rows.map((row) => row[field] ?? 0));
  const scale = scaleLinear()
    .domain([0, top > 0 ? top : 1])
    .nice(4);
  const [low = 0, high = 1] = scale.domain();
  return { domain: [low, high], ticks: scale.ticks(4) };
}

function MiniTrend({ field, rows, year }: { field: MeasureField; rows: Row[]; year: number }) {
  const { t, locale, measure } = useI18n();
  const current = rows.find((row) => row.year === year);
  const currentValue = current?.[field] ?? null;
  const axis = axisFor(field, rows);
  const isFirst = rows[0]?.year === year;
  const isLast = rows[rows.length - 1]?.year === year;

  function renderTooltip({ active, payload }: TooltipProps) {
    const row = payload?.[0]?.payload;
    if (!active || !row) return null;
    return (
      <div className="tooltip is-static">
        <strong>{measure(field, row[field])}</strong>
        <span>{row.year}</span>
      </div>
    );
  }

  // The selected year's value, written above its point. At either end of the
  // line the text is aligned inwards so that it stays inside the plot.
  function renderCurrentLabel({ viewBox }: DotLabelProps) {
    const centre = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) / 2;
    return (
      <text
        x={centre + (isFirst ? -6 : isLast ? 6 : 0)}
        y={(viewBox?.y ?? 0) - 7}
        textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
        className="chart-value-label"
      >
        {measure(field, currentValue)}
      </text>
    );
  }

  return (
    <figure className="mini-chart">
      <figcaption>{t(`metric.${field}`)}</figcaption>
      <ResponsiveContainer width="100%" height={184}>
        <AreaChart data={rows} margin={{ top: 26, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`trend-wash-${field}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--series-1)" stopOpacity={0.22} />
              <stop offset="1" stopColor="var(--series-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="year"
            interval={1}
            tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            padding={{ left: 18, right: 18 }}
          />
          <YAxis
            width={locale === 'ru' ? 62 : 48}
            ticks={axis.ticks}
            domain={axis.domain}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={(value: number) => formatAxis(field, value, locale)}
          />
          <Tooltip
            content={renderTooltip}
            cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Area
            type="linear"
            dataKey={field}
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={`url(#trend-wash-${field})`}
            dot={{
              r: 4.5,
              fill: 'var(--series-1)',
              fillOpacity: 1,
              stroke: 'var(--surface-sunken)',
              strokeWidth: 1.5,
            }}
            activeDot={{
              r: 6,
              fill: 'var(--series-1)',
              fillOpacity: 1,
              stroke: 'var(--surface-sunken)',
              strokeWidth: 1.5,
            }}
            connectNulls={false}
            animationDuration={700}
            animationEasing="ease-out"
          />
          {currentValue !== null ? (
            <ReferenceDot
              x={year}
              y={currentValue}
              r={6}
              fill="var(--series-1)"
              stroke="var(--text-primary)"
              strokeWidth={1.5}
              label={renderCurrentLabel}
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}

/** Seven-year trend of one selection: small multiples with a table twin. */
export function TrendCharts({ rows, year }: Props) {
  const { t, measure } = useI18n();
  const [asTable, setAsTable] = useState(false);
  return (
    <div className="trend">
      <div className="trend-head">
        <p className="note">{t('trend.caption')}</p>
        <button type="button" className="link-button" onClick={() => setAsTable(!asTable)}>
          {asTable ? t('trend.charts') : t('trend.table')}
        </button>
      </div>
      {asTable ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t('trend.year')}</th>
                {TABLE_FIELDS.map((field) => (
                  <th key={field} scope="col" className="is-number">
                    {t(`metric.short.${field}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.year} className={row.year === year ? 'is-selected' : undefined}>
                  <th scope="row">{row.year}</th>
                  {TABLE_FIELDS.map((field) => (
                    <td
                      key={field}
                      className={row[field] === null ? 'is-number is-no-data' : 'is-number'}
                    >
                      {measure(field, row[field])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mini-charts">
          {CHART_FIELDS.map((field) => (
            <MiniTrend key={field} field={field} rows={rows} year={year} />
          ))}
        </div>
      )}
    </div>
  );
}
