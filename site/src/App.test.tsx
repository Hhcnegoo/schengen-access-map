import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { BreakdownTable, sortRows } from './components/BreakdownTable';
import { axisFor } from './components/TrendCharts';
import { ALL_COUNTRIES, dataset } from './data/dataset';
import { formatCount, formatPercent } from './i18n/format';
import { I18nProvider } from './i18n/I18nContext';

function open(hash: string) {
  window.location.hash = hash;
  return render(<App dataset={dataset} />);
}

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('page', () => {
  it('shows the figures of the selected country and year from the processed data', () => {
    open('#lang=en&year=2019&metric=uniform_applied&country=BLR&view=countries');
    const detail = screen.getByRole('region', { name: 'Belarus, 2019' });
    const row = dataset.countrySummary('BLR', 2019)!;
    for (const value of [row.uniform_applied, row.uniform_issued, row.mev_issued, row.uniform_not_issued]) {
      expect(within(detail).getAllByText(formatCount(value!, 'en')).length).toBeGreaterThan(0);
    }
    expect(within(detail).getAllByText(formatPercent(row.mev_share!, 'en')).length).toBeGreaterThan(0);
  });

  it('prints every country and year of the chosen indicator in the comparison table', () => {
    open('#lang=en&year=2024&metric=not_issued_rate&country=ALL&view=countries');
    const table = within(screen.getByRole('region', { name: 'By country and year' })).getByRole('table');
    for (const country of dataset.countries) {
      const cells = within(within(table).getByText(country.name_en).closest('tr')!).getAllByRole('cell');
      expect(cells.map((cell) => cell.textContent)).toEqual(
        dataset.years.map((year) =>
          formatPercent(dataset.countrySummary(country.iso3, year)!.not_issued_rate!, 'en'),
        ),
      );
    }
    const total = within(within(table).getByText('All seven countries').closest('tr')!).getAllByRole('cell');
    expect(total.map((cell) => cell.textContent)).toEqual(
      dataset.years.map((year) =>
        formatPercent(dataset.summary(ALL_COUNTRIES, year)!.not_issued_rate!, 'en'),
      ),
    );
  });

  it('shows "no data" for an empty source cell instead of zero', () => {
    open('#lang=en&year=2019&metric=uniform_applied&country=ARM&view=countries');
    const czechia = screen.getByRole('rowheader', { name: 'Czechia' }).closest('tr')!;
    const cells = within(czechia).getAllByRole('cell').map((cell) => cell.textContent);
    // Applied for, issued, MEVs, share, LTVs, not issued, rate, consulate entries
    expect(cells[4]).toBe('no data');
    expect(cells[0]).toContain('3,074');
    expect(cells).not.toContain('0');
  });

  it('switches every label to Russian and keeps the figures', () => {
    open('#lang=en&year=2019&metric=uniform_applied&country=BLR&view=countries');
    fireEvent.click(screen.getByRole('button', { name: 'Русский' }));
    expect(document.documentElement.lang).toBe('ru');
    expect(window.location.hash).toContain('lang=ru');
    const detail = screen.getByRole('region', { name: 'Беларусь, 2019' });
    // Testing Library compares against text with no-break spaces collapsed.
    const applied = formatCount(dataset.countrySummary('BLR', 2019)!.uniform_applied!, 'ru');
    expect(within(detail).getAllByText(applied.replace(/\s/g, ' ')).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 2, name: 'Запрошено единых виз, 2019' })).toBeTruthy();
  });

  it('follows the controls: year, indicator and country', () => {
    open('#lang=en&year=2025&metric=uniform_applied&country=ALL&view=countries');
    fireEvent.click(within(screen.getByRole('group', { name: 'Year' })).getByRole('button', { name: '2021' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Indicator' })).getByRole('button', { name: 'Not issued rate' }),
    );
    fireEvent.change(screen.getByLabelText('Country of consulate location'), { target: { value: 'KAZ' } });
    expect(screen.getByRole('heading', { level: 2, name: 'Not issued rate, 2021' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Kazakhstan, 2021' })).toBeTruthy();
    expect(window.location.hash).toBe('#lang=en&year=2021&metric=not_issued_rate&country=KAZ&view=countries');
  });

  it('draws the globe from the bundled atlas with one area per country', async () => {
    open('#lang=en&year=2024&metric=uniform_applied&country=ALL&view=countries');
    const map = await screen.findByRole('group', { name: 'Map: Uniform visas applied for, 2024' }, { timeout: 10000 });
    const areas = within(map).getAllByRole('button');
    expect(areas).toHaveLength(dataset.countries.length);
    for (const area of areas) expect(area.getAttribute('d')).toMatch(/^M/);
    const russia = areas.find((area) => area.getAttribute('aria-label')?.startsWith('Show Russia'))!;
    expect(russia.getAttribute('aria-label')).toContain(
      formatCount(dataset.countrySummary('RUS', 2024)!.uniform_applied!, 'en'),
    );
  });

  it('shows the figures of a country when it is clicked on the globe', async () => {
    open('#lang=en&year=2024&metric=uniform_applied&country=ALL&view=countries');
    const map = await screen.findByRole('group', { name: /^Map:/ }, { timeout: 10000 });
    const panel = screen.getByRole('complementary');
    // Until a country is chosen the card lists the seven countries combined.
    expect(within(panel).getByRole('heading', { name: 'All seven countries, 2024' })).toBeTruthy();
    const total = dataset.summary(ALL_COUNTRIES, 2024)!;
    expect(within(panel).getByText(formatCount(total.uniform_applied!, 'en'))).toBeTruthy();
    expect(panel.textContent).toContain('click it to see its figures');
    expect(within(panel).queryByRole('button', { name: 'Clear the choice' })).toBeNull();

    fireEvent.click(within(map).getByRole('button', { name: /^Show Russia/ }));
    expect(within(panel).getByRole('heading', { name: 'Russia, 2024' })).toBeTruthy();
    const row = dataset.countrySummary('RUS', 2024)!;
    expect(within(panel).getByText(formatCount(row.uniform_applied!, 'en'))).toBeTruthy();
    expect(within(panel).getByText(formatPercent(row.not_issued_rate!, 'en'))).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Russia, 2024' })).toBeTruthy();
    expect(window.location.hash).toContain('country=RUS');

    fireEvent.click(within(panel).getByRole('button', { name: 'Clear the choice' }));
    expect(within(panel).getByRole('heading', { name: 'All seven countries, 2024' })).toBeTruthy();
    expect(window.location.hash).toContain('country=ALL');
  });

  it('shows the figures of a Schengen State clicked in the States view', async () => {
    open('#lang=en&year=2019&metric=uniform_applied&country=ARM&view=states');
    const map = await screen.findByRole('group', { name: /^Map:/ }, { timeout: 10000 });
    const rows = dataset.stateRows('ARM', 2019);
    expect(within(map).getAllByRole('button')).toHaveLength(rows.length);

    fireEvent.click(within(map).getByRole('button', { name: /^Show Czechia/ }));
    const panel = screen.getByRole('complementary');
    expect(within(panel).getByRole('heading', { name: 'Czechia, 2019' })).toBeTruthy();
    expect(panel.textContent).toContain('Location of consulates: Armenia');
    expect(within(panel).getByText('3,074')).toBeTruthy();
    // The LTV cell of this row is empty in the source.
    expect(within(panel).getByText('no data')).toBeTruthy();
    // The selected country itself does not change.
    expect(screen.getByRole('heading', { level: 2, name: 'Armenia, 2019' })).toBeTruthy();
  });
});

describe('year playback', () => {
  it('steps through the years and stops at the last one', () => {
    vi.useFakeTimers();
    try {
      open('#lang=en&year=2023&metric=uniform_applied&country=ALL&view=countries');
      const play = screen.getByRole('button', { name: 'Play the years in turn' });
      fireEvent.click(play);
      expect(screen.getByRole('button', { name: 'Pause' }).getAttribute('aria-pressed')).toBe('true');
      act(() => void vi.advanceTimersByTime(1800));
      expect(window.location.hash).toContain('year=2024');
      act(() => void vi.advanceTimersByTime(1800));
      expect(window.location.hash).toContain('year=2025');
      act(() => void vi.advanceTimersByTime(1800));
      expect(window.location.hash).toContain('year=2025');
      expect(screen.getByRole('button', { name: 'Play the years in turn' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts over from the first year when played at the last one', () => {
    vi.useFakeTimers();
    try {
      open('#lang=en&year=2025&metric=uniform_applied&country=ALL&view=countries');
      fireEvent.click(screen.getByRole('button', { name: 'Play the years in turn' }));
      expect(window.location.hash).toContain('year=2019');
      fireEvent.click(within(screen.getByRole('group', { name: 'Year' })).getByRole('button', { name: '2022' }));
      expect(screen.getByRole('button', { name: 'Play the years in turn' })).toBeTruthy();
      act(() => void vi.advanceTimersByTime(4000));
      expect(window.location.hash).toContain('year=2022');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('map view', () => {
  it('switches between consulate countries and Schengen States', () => {
    open('#lang=en&year=2024&metric=uniform_applied&country=KAZ&view=countries');
    const toggle = screen.getByRole('group', { name: 'Map shows' });
    fireEvent.click(within(toggle).getByRole('button', { name: 'Schengen States' }));
    expect(window.location.hash).toContain('view=states');
    expect(screen.getByRole('complementary').textContent).toContain('Location of consulates: Kazakhstan');
  });
});

describe('breakdown table', () => {
  it('lists consulates by city with the names of the selected language', () => {
    render(
      <I18nProvider locale="ru">
        <BreakdownTable dataset={dataset} selection="KAZ" selectionName="Казахстан" year={2024} />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Консульства' }));
    expect(screen.getAllByText('Астана').length).toBeGreaterThan(1);
    expect(screen.queryByText('NUR-SULTAN')).toBeNull();
  });

  it('sorts missing values last in both directions', () => {
    const measures = (ltv: number | null) => ({
      uniform_applied: 1, uniform_issued: 1, mev_issued: 1, ltv_issued: ltv,
      uniform_not_issued: 0, mev_share: 1, not_issued_rate: 0,
    });
    const rows = [
      { id: 'a', country: '', state: 'A', city: '', entries: 1, measures: measures(null) },
      { id: 'b', country: '', state: 'B', city: '', entries: 1, measures: measures(5) },
      { id: 'c', country: '', state: 'C', city: '', entries: 1, measures: measures(0) },
    ];
    expect(sortRows(rows, { key: 'ltv_issued', descending: true }, 'en').map((row) => row.id)).toEqual(['b', 'c', 'a']);
    expect(sortRows(rows, { key: 'ltv_issued', descending: false }, 'en').map((row) => row.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('chart axes', () => {
  it('start at zero and use round tick values', () => {
    const rows = dataset.series('BLR');
    const counts = axisFor('uniform_applied', rows);
    expect(counts.domain[0]).toBe(0);
    expect(counts.domain[1]).toBeGreaterThanOrEqual(645722);
    expect(counts.ticks[0]).toBe(0);
    expect(counts.ticks.every((tick) => tick % 50000 === 0)).toBe(true);
    expect(axisFor('mev_share', rows)).toEqual({ domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] });
  });
});
