import { describe, expect, it } from 'vitest';
import { buildColorScale, inkOn } from './colorScale';

describe('colour scale', () => {
  it('gives no colour to a missing value', () => {
    const scale = buildColorScale('uniform_applied', [1000, 50000], 'light');
    expect(scale.color(null)).toBeNull();
    expect(scale.color(undefined)).toBeNull();
    expect(scale.color(0)).not.toBeNull();
  });

  it('uses whole decades for counts', () => {
    const scale = buildColorScale('uniform_applied', [2586, null, 4133100], 'light');
    expect(scale.kind).toBe('log');
    expect(scale.domain).toEqual([1000, 10000000]);
    expect(scale.ticks).toEqual([1000, 10000, 100000, 1000000, 10000000]);
    expect(scale.position(1000)).toBe(0);
    expect(scale.position(10000000)).toBe(1);
    expect(scale.position(100000)).toBeCloseTo(0.5);
  });

  it('puts zero and values below the scale at the first colour', () => {
    const scale = buildColorScale('uniform_applied', [0, 1000, 50000], 'light');
    expect(scale.position(0)).toBe(0);
    expect(scale.color(0)).toBe(scale.color(1000));
  });

  it('runs shares to 100% and rates to the next 10% above the data', () => {
    expect(buildColorScale('mev_share', [0.2, 0.5], 'light').domain).toEqual([0, 1]);
    expect(buildColorScale('not_issued_rate', [0.02, 0.204], 'light').domain).toEqual([0, 0.3]);
    expect(buildColorScale('not_issued_rate', [null], 'light').domain).toEqual([0, 0.1]);
  });

  it('orders colours by value and flips the ramp on a dark surface', () => {
    const light = buildColorScale('mev_share', [0, 1], 'light');
    const dark = buildColorScale('mev_share', [0, 1], 'dark');
    expect(light.color(0)).toBe(dark.color(1));
    expect(light.color(1)).toBe(dark.color(0));
    expect(light.samples).toHaveLength(24);
    expect(light.samples[0]).toBe(light.color(0));
    expect(light.samples.at(-1)).toBe(light.color(1));
  });

  it('picks readable ink for text on a fill', () => {
    expect(inkOn('#cde2fb')).toBe('#0b0b0b');
    expect(inkOn('#0d366b')).toBe('#ffffff');
    expect(inkOn('rgb(13, 54, 107)')).toBe('#ffffff');
  });
});
