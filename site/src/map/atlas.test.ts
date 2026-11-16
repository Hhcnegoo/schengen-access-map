import coarse from 'world-atlas/countries-110m.json';
import detailed from 'world-atlas/countries-50m.json';
import { geoDistance } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import { dataset } from '../data/dataset';
import { GLOBE_SIZE, MAX_ZOOM, MIN_ZOOM, buildAtlas, createProjection } from './atlas';
import { HOME_CENTRE, labelFor } from './labels';

const atlas = buildAtlas(detailed, coarse);
const byId = new Map(atlas.countries.map((country) => [country.id, country]));
const centreOf = (code: string) =>
  byId.get(dataset.states.find((state) => state.iso2 === code)!.iso_n3)!.focus.centre;

describe('globe atlas', () => {
  it('has a shape for every country and Schengen State of the dataset', () => {
    for (const item of [...dataset.countries, ...dataset.states]) {
      expect(byId.has(item.iso_n3), `${item.name_en} (${item.iso_n3})`).toBe(true);
    }
  });

  it('holds land and borders at two levels of detail', () => {
    expect(atlas.detailed.borders.coordinates.length).toBeGreaterThan(
      atlas.coarse.borders.coordinates.length,
    );
  });

  it('frames each country within the zoom limits', () => {
    for (const item of [...dataset.countries, ...dataset.states]) {
      const { zoom, centre } = byId.get(item.iso_n3)!.focus;
      expect(zoom, item.name_en).toBeGreaterThanOrEqual(MIN_ZOOM);
      expect(zoom, item.name_en).toBeLessThanOrEqual(MAX_ZOOM);
      expect(Math.abs(centre[0]), item.name_en).toBeLessThanOrEqual(180);
      expect(Math.abs(centre[1]), item.name_en).toBeLessThanOrEqual(90);
    }
    const zoomOf = (iso3: string) => byId.get(dataset.country(iso3)!.iso_n3)!.focus.zoom;
    expect(zoomOf('ARM')).toBeGreaterThan(zoomOf('KAZ'));
    expect(zoomOf('KAZ')).toBeGreaterThan(zoomOf('RUS'));
  });

  it('centres on the largest landmass, not on overseas territories', () => {
    // Distances in radians from a point inside the European part of each State.
    expect(geoDistance(centreOf('FR'), [2.5, 46.5])).toBeLessThan(0.05);
    expect(geoDistance(centreOf('NL'), [5.5, 52.2])).toBeLessThan(0.03);
    expect(geoDistance(centreOf('NO'), [13, 65])).toBeLessThan(0.1);
    expect(geoDistance(centreOf('ES'), [-3.5, 40])).toBeLessThan(0.05);
  });

  it('puts the centre of a focused country in the middle of the drawing', () => {
    const { focus } = byId.get(dataset.country('KAZ')!.iso_n3)!;
    const point = createProjection(focus)(focus.centre)!;
    expect(point[0]).toBeCloseTo(GLOBE_SIZE / 2);
    expect(point[1]).toBeCloseTo(GLOBE_SIZE / 2);
  });

  it('shows the seven countries on the default view', () => {
    for (const country of dataset.countries) {
      const anchor = labelFor(country.iso3);
      expect(anchor, country.name_en).not.toBeNull();
      expect(geoDistance(anchor!.at, HOME_CENTRE.countries), country.name_en).toBeLessThan(Math.PI / 2);
    }
    expect(labelFor('FRA')).toBeNull();
  });
});
