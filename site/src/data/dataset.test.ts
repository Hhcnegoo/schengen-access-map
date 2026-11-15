import raw from '@data/site_data.json';
import { describe, expect, it } from 'vitest';
import { ALL_COUNTRIES, dataset } from './dataset';
import { parseSiteData } from './parse';

const clone = () => structuredClone(raw) as Record<string, Record<string, unknown>[]>;

describe('processed data bundle', () => {
  it('covers 2019-2025 and the seven countries in scope', () => {
    expect(dataset.years).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(dataset.countries.map((country) => country.iso3)).toEqual([
      'BLR', 'RUS', 'ARM', 'AZE', 'KAZ', 'UZB', 'KGZ',
    ]);
    for (const country of dataset.countries) {
      expect(dataset.series(country.iso3)).toHaveLength(7);
    }
    expect(dataset.series(ALL_COUNTRIES)).toHaveLength(7);
  });

  it('returns the figures of the processed tables unchanged', () => {
    // Totals printed for Belarus, 2019, in the source sheet "Totals - third country".
    const row = dataset.countrySummary('BLR', 2019);
    expect(row?.uniform_applied).toBe(645722);
    expect(row?.uniform_issued).toBe(643474);
    expect(row?.mev_issued).toBe(550656);
    expect(row?.ltv_issued).toBe(195);
    expect(row?.uniform_not_issued).toBe(1766);
  });

  it('keeps empty source cells as null', () => {
    const row = dataset
      .stateRows('ARM', 2019)
      .find((item) => item.schengen_state_iso2 === 'CZ');
    expect(row?.ltv_issued).toBeNull();
    expect(row?.uniform_applied).toBe(3074);
  });

  it('lists State rows for one country or for all seven', () => {
    const kyrgyzstan = dataset.stateRows('KGZ', 2019);
    expect(kyrgyzstan.map((row) => row.schengen_state_iso2)).toEqual(['CH', 'DE']);
    expect(kyrgyzstan.map((row) => row.uniform_applied)).toEqual([4835, 13432]);
    expect(dataset.stateRows(ALL_COUNTRIES, 2019)).toHaveLength(25);
    expect(dataset.consulateRows('BLR', 2019)).toHaveLength(14);
  });

  it('names every State and city used by the tables', () => {
    for (const row of dataset.data.country_state_year) {
      expect(dataset.state(row.schengen_state_iso2), row.schengen_state_iso2).toBeDefined();
    }
    for (const row of dataset.data.consulate_year) {
      expect(dataset.city(row.consulate_id), row.consulate_id).toBeDefined();
    }
  });
});

describe('parseSiteData', () => {
  it('accepts the bundle produced by the pipeline', () => {
    expect(() => parseSiteData(raw)).not.toThrow();
  });

  it('rejects a count that is not a whole non-negative number', () => {
    const negative = clone();
    negative.country_year![0]!.uniform_applied = -1;
    expect(() => parseSiteData(negative)).toThrow(/uniform_applied/);
    const text = clone();
    text.consulate_year![0]!.ltv_issued = '12';
    expect(() => parseSiteData(text)).toThrow(/ltv_issued/);
  });

  it('rejects a ratio outside 0-1 and a missing field', () => {
    const ratio = clone();
    ratio.total_year![0]!.not_issued_rate = 1.2;
    expect(() => parseSiteData(ratio)).toThrow(/not_issued_rate/);
    const missing = clone();
    delete missing.state_year![0]!.mev_share;
    expect(() => parseSiteData(missing)).toThrow(/mev_share/);
  });

  it('rejects a bundle without tables', () => {
    expect(() => parseSiteData({ meta: (raw as { meta: unknown }).meta })).toThrow(/countries/);
    expect(() => parseSiteData(null)).toThrow();
  });
});
