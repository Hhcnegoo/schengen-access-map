import { COUNT_FIELDS, RATIO_FIELDS } from './types';
import type { SiteData } from './types';

/**
 * Check the bundle produced by the pipeline before the site uses it. The site
 * never repairs data: a bundle that does not match the expected shape throws.
 */

type Json = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(`site_data.json: ${message}`);
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rows(root: Json, key: string): Json[] {
  const value = root[key];
  if (!Array.isArray(value) || value.length === 0 || !value.every(isObject)) {
    fail(`"${key}" must be a non-empty list of records`);
  }
  return value;
}

function requireText(row: Json, key: string, where: string): void {
  if (typeof row[key] !== 'string' || row[key] === '') fail(`${where}: "${key}" must be text`);
}

function requireInteger(row: Json, key: string, where: string): void {
  if (!Number.isInteger(row[key])) fail(`${where}: "${key}" must be an integer`);
}

function requireCountOrNull(row: Json, key: string, where: string): void {
  const value = row[key];
  if (value === null) return;
  if (!Number.isInteger(value) || (value as number) < 0) {
    fail(`${where}: "${key}" must be a non-negative integer or null`);
  }
}

function requireRatioOrNull(row: Json, key: string, where: string): void {
  const value = row[key];
  if (value === null) return;
  if (typeof value !== 'number' || !(value >= 0 && value <= 1)) {
    fail(`${where}: "${key}" must be a number between 0 and 1 or null`);
  }
}

function checkMeasures(row: Json, where: string): void {
  for (const field of COUNT_FIELDS) requireCountOrNull(row, field, where);
  for (const field of RATIO_FIELDS) requireRatioOrNull(row, field, where);
}

function checkCoverage(row: Json, where: string, withStates: boolean): void {
  requireInteger(row, 'consulate_entries', where);
  requireInteger(row, 'consulates_with_applications', where);
  for (const field of COUNT_FIELDS) requireInteger(row, `blank_${field}`, where);
  if (withStates) {
    requireInteger(row, 'states_listed', where);
    requireInteger(row, 'states_with_applications', where);
  }
}

export function parseSiteData(raw: unknown): SiteData {
  if (!isObject(raw)) fail('root must be an object');
  const meta = raw.meta;
  if (!isObject(meta) || !Array.isArray(meta.years) || !meta.years.every(Number.isInteger)) {
    fail('"meta.years" must be a list of years');
  }
  if (typeof meta.source_page !== 'string' || typeof meta.publisher !== 'string') {
    fail('"meta" must name the source page and publisher');
  }
  if (!Array.isArray(meta.source_files) || !isObject(meta.source_not_issued_rate_denominator)) {
    fail('"meta" must list the source files and rate definitions');
  }

  for (const [index, row] of rows(raw, 'countries').entries()) {
    for (const key of ['iso3', 'iso_n3', 'name_en', 'name_ru']) {
      requireText(row, key, `countries[${index}]`);
    }
  }
  for (const [index, row] of rows(raw, 'states').entries()) {
    for (const key of ['iso2', 'iso_n3', 'name_en', 'name_ru']) {
      requireText(row, key, `states[${index}]`);
    }
    if (!Array.isArray(row.years)) fail(`states[${index}]: "years" must be a list`);
  }
  for (const [index, row] of rows(raw, 'consulates').entries()) {
    for (const key of ['consulate_id', 'country_iso3', 'name_en', 'name_ru']) {
      requireText(row, key, `consulates[${index}]`);
    }
  }

  for (const [index, row] of rows(raw, 'total_year').entries()) {
    const where = `total_year[${index}]`;
    requireInteger(row, 'year', where);
    checkMeasures(row, where);
    checkCoverage(row, where, true);
  }
  for (const [index, row] of rows(raw, 'country_year').entries()) {
    const where = `country_year[${index}]`;
    requireInteger(row, 'year', where);
    requireText(row, 'country_iso3', where);
    checkMeasures(row, where);
    checkCoverage(row, where, true);
    requireRatioOrNull(row, 'not_issued_rate_source', where);
  }
  for (const [index, row] of rows(raw, 'state_year').entries()) {
    const where = `state_year[${index}]`;
    requireInteger(row, 'year', where);
    requireText(row, 'schengen_state_iso2', where);
    checkMeasures(row, where);
    checkCoverage(row, where, false);
  }
  for (const [index, row] of rows(raw, 'country_state_year').entries()) {
    const where = `country_state_year[${index}]`;
    requireInteger(row, 'year', where);
    requireText(row, 'country_iso3', where);
    requireText(row, 'schengen_state_iso2', where);
    checkMeasures(row, where);
    checkCoverage(row, where, false);
  }
  for (const [index, row] of rows(raw, 'consulate_year').entries()) {
    const where = `consulate_year[${index}]`;
    requireInteger(row, 'year', where);
    for (const key of ['country_iso3', 'schengen_state_iso2', 'consulate_id']) {
      requireText(row, key, where);
    }
    checkMeasures(row, where);
  }
  return raw as SiteData;
}
