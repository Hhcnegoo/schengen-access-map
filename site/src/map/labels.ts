/**
 * Where to write each country's name on the globe: longitude, latitude and
 * text alignment. Small neighbouring countries are labelled beside the shape.
 */
export type LabelAnchor = { at: [number, number]; align: 'start' | 'middle' | 'end' };

const LABEL_ANCHORS: Record<string, LabelAnchor> = {
  BLR: { at: [27.9, 53.3], align: 'middle' },
  RUS: { at: [62, 60.5], align: 'middle' },
  ARM: { at: [43.2, 39.3], align: 'end' },
  AZE: { at: [49.6, 39.4], align: 'start' },
  KAZ: { at: [67, 48.3], align: 'middle' },
  UZB: { at: [62.5, 42.2], align: 'middle' },
  KGZ: { at: [76.5, 40.4], align: 'middle' },
};

export function labelFor(iso3: string): LabelAnchor | null {
  return LABEL_ANCHORS[iso3] ?? null;
}

/** Default centre of the globe for each map view. */
export const HOME_CENTRE = {
  countries: [58, 47],
  states: [22, 50],
} as const satisfies Record<string, [number, number]>;
