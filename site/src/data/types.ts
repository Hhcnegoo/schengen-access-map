/**
 * Shape of `data/processed/site_data.json`. Field names are the column names
 * of the processed CSV tables. `null` means the source cell is empty.
 */

export const COUNT_FIELDS = [
  'uniform_applied',
  'uniform_issued',
  'mev_issued',
  'ltv_issued',
  'uniform_not_issued',
] as const;
export type CountField = (typeof COUNT_FIELDS)[number];

export const RATIO_FIELDS = ['mev_share', 'not_issued_rate'] as const;
export type RatioField = (typeof RATIO_FIELDS)[number];

export type MeasureField = CountField | RatioField;

export type Measures = Record<MeasureField, number | null>;

/** Coverage counters carried by every aggregated row. */
export type Coverage = {
  consulate_entries: number;
  consulates_with_applications: number;
} & Record<`blank_${CountField}`, number>;

export type StateCoverage = {
  states_listed: number;
  states_with_applications: number;
};

export type TotalYearRow = { year: number } & Measures & Coverage & StateCoverage;

export type CountryYearRow = TotalYearRow & {
  country_iso3: string;
  /** Rate printed for the country in the source file's totals sheet. */
  not_issued_rate_source: number | null;
};

export type StateYearRow = { year: number; schengen_state_iso2: string } & Measures & Coverage;

export type CountryStateYearRow = StateYearRow & { country_iso3: string };

export type ConsulateYearRow = {
  year: number;
  country_iso3: string;
  schengen_state_iso2: string;
  consulate_id: string;
  consulate_source_name: string;
  source_row: number;
} & Measures;

export type Country = {
  iso3: string;
  iso_n3: string;
  name_en: string;
  name_ru: string;
};

export type SchengenState = {
  iso2: string;
  iso_n3: string;
  name_en: string;
  name_ru: string;
  /** Years in which the State appears in the source sheet. */
  years: number[];
};

export type ConsulateCity = {
  consulate_id: string;
  country_iso3: string;
  name_en: string;
  name_ru: string;
  source_names: string[];
};

export type SourceFile = {
  year: number;
  url: string;
  sha256: string;
  retrieved: string;
};

export type SiteData = {
  meta: {
    years: number[];
    source_page: string;
    publisher: string;
    source_files: SourceFile[];
    /** How each yearly file computes its own "not issued rate" column. */
    source_not_issued_rate_denominator: Record<string, 'applications' | 'decisions'>;
  };
  countries: Country[];
  states: SchengenState[];
  consulates: ConsulateCity[];
  total_year: TotalYearRow[];
  country_year: CountryYearRow[];
  state_year: StateYearRow[];
  country_state_year: CountryStateYearRow[];
  consulate_year: ConsulateYearRow[];
};
