import { createProjection } from './atlas';

/**
 * Where to write each country's name on the map: longitude, latitude and
 * text alignment. Small neighbouring countries are labelled beside the shape.
 */
const LABEL_ANCHORS: Record<string, { at: [number, number]; align: 'start' | 'middle' | 'end' }> = {
  BLR: { at: [27.9, 53.3], align: 'middle' },
  RUS: { at: [60, 60.5], align: 'middle' },
  ARM: { at: [43.2, 39.0], align: 'end' },
  AZE: { at: [49.6, 39.2], align: 'start' },
  KAZ: { at: [67, 48.3], align: 'middle' },
  UZB: { at: [62.5, 42.2], align: 'middle' },
  KGZ: { at: [76.5, 40.2], align: 'middle' },
};

export type MapLabel = { x: number; y: number; align: 'start' | 'middle' | 'end' };

const projection = createProjection();

export function labelFor(iso3: string): MapLabel | null {
  const anchor = LABEL_ANCHORS[iso3];
  const point = anchor ? projection(anchor.at) : null;
  return anchor && point ? { x: point[0], y: point[1], align: anchor.align } : null;
}
