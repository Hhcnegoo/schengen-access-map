import topology from 'world-atlas/countries-50m.json';
import { describe, expect, it } from 'vitest';
import { dataset } from '../data/dataset';
import { MAP_HEIGHT, MAP_WIDTH, buildShapes } from './atlas';
import { labelFor } from './labels';

const shapes = buildShapes(topology);
const byId = new Map(shapes.map((shape) => [shape.id, shape]));

describe('map shapes', () => {
  it('include every country and Schengen State of the dataset', () => {
    for (const item of [...dataset.countries, ...dataset.states]) {
      expect(byId.has(item.iso_n3), `${item.name_en} (${item.iso_n3})`).toBe(true);
    }
  });

  it('stay inside the drawing', () => {
    for (const item of [...dataset.countries, ...dataset.states]) {
      const [x, y] = byId.get(item.iso_n3)!.centroid;
      expect(x, item.name_en).toBeGreaterThanOrEqual(0);
      expect(x, item.name_en).toBeLessThanOrEqual(MAP_WIDTH);
      expect(y, item.name_en).toBeGreaterThanOrEqual(0);
      expect(y, item.name_en).toBeLessThanOrEqual(MAP_HEIGHT);
    }
  });

  it('flag the smallest States so that they get a marker', () => {
    const small = dataset.states.filter((state) => byId.get(state.iso_n3)!.small).map((state) => state.iso2);
    expect(small).toContain('MT');
    expect(small).toContain('LU');
    expect(small).not.toContain('DE');
  });

  it('have a label position for each of the seven countries', () => {
    for (const country of dataset.countries) {
      const label = labelFor(country.iso3);
      expect(label, country.name_en).not.toBeNull();
      expect(label!.x).toBeGreaterThan(0);
      expect(label!.x).toBeLessThan(MAP_WIDTH);
      expect(label!.y).toBeGreaterThan(0);
      expect(label!.y).toBeLessThan(MAP_HEIGHT);
    }
    expect(labelFor('FRA')).toBeNull();
  });
});
