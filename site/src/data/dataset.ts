import raw from '@data/site_data.json';
import { parseSiteData } from './parse';
import type {
  ConsulateCity,
  ConsulateYearRow,
  Country,
  CountryStateYearRow,
  CountryYearRow,
  SchengenState,
  SiteData,
  StateYearRow,
  TotalYearRow,
} from './types';

/** Selection value meaning "the seven countries combined". */
export const ALL_COUNTRIES = 'ALL';

/** A country ISO 3166-1 alpha-3 code or `ALL_COUNTRIES`. */
export type Selection = string;

/** Read-only lookups over the processed data. No value is computed here. */
export class Dataset {
  readonly years: readonly number[];
  readonly countries: readonly Country[];
  readonly states: readonly SchengenState[];

  private readonly countryByIso3 = new Map<string, Country>();
  private readonly stateByIso2 = new Map<string, SchengenState>();
  private readonly cityById = new Map<string, ConsulateCity>();
  private readonly totalByYear = new Map<number, TotalYearRow>();
  private readonly countryYear = new Map<string, CountryYearRow>();

  constructor(readonly data: SiteData) {
    this.years = data.meta.years;
    this.countries = data.countries;
    this.states = data.states;
    for (const country of data.countries) this.countryByIso3.set(country.iso3, country);
    for (const state of data.states) this.stateByIso2.set(state.iso2, state);
    for (const city of data.consulates) this.cityById.set(city.consulate_id, city);
    for (const row of data.total_year) this.totalByYear.set(row.year, row);
    for (const row of data.country_year) {
      this.countryYear.set(`${row.country_iso3}|${row.year}`, row);
    }
  }

  isCountry(selection: Selection): boolean {
    return this.countryByIso3.has(selection);
  }

  country(iso3: string): Country | undefined {
    return this.countryByIso3.get(iso3);
  }

  state(iso2: string): SchengenState | undefined {
    return this.stateByIso2.get(iso2);
  }

  city(consulateId: string): ConsulateCity | undefined {
    return this.cityById.get(consulateId);
  }

  /** Totals for one country, or for the seven countries combined. */
  summary(selection: Selection, year: number): TotalYearRow | CountryYearRow | undefined {
    return selection === ALL_COUNTRIES
      ? this.totalByYear.get(year)
      : this.countryYear.get(`${selection}|${year}`);
  }

  countrySummary(iso3: string, year: number): CountryYearRow | undefined {
    return this.countryYear.get(`${iso3}|${year}`);
  }

  /** One summary per year, in year order; years without a row are skipped. */
  series(selection: Selection): (TotalYearRow | CountryYearRow)[] {
    return this.years.flatMap((year) => this.summary(selection, year) ?? []);
  }

  /** Rows per Schengen State for one year. */
  stateRows(selection: Selection, year: number): (StateYearRow | CountryStateYearRow)[] {
    return selection === ALL_COUNTRIES
      ? this.data.state_year.filter((row) => row.year === year)
      : this.data.country_state_year.filter(
          (row) => row.year === year && row.country_iso3 === selection,
        );
  }

  /** Rows per Schengen State for every year (used to fix a colour scale). */
  stateRowsAllYears(selection: Selection): (StateYearRow | CountryStateYearRow)[] {
    return selection === ALL_COUNTRIES
      ? this.data.state_year
      : this.data.country_state_year.filter((row) => row.country_iso3 === selection);
  }

  /** Consulate rows for one year. */
  consulateRows(selection: Selection, year: number): ConsulateYearRow[] {
    return this.data.consulate_year.filter(
      (row) =>
        row.year === year && (selection === ALL_COUNTRIES || row.country_iso3 === selection),
    );
  }
}

export const dataset = new Dataset(parseSiteData(raw));
