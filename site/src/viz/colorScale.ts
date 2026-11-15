import { scaleLinear } from 'd3-scale';
import type { MeasureField } from '../data/types';
import { isRatioField } from '../i18n/format';

/**
 * Sequential colour scale for the map and the comparison table: one hue,
 * lightness carries magnitude. The scale only decides colours; it never
 * changes or produces a displayed number.
 */

/** Blue ramp, light to dark (steps 100-700 of the reference palette). */
const RAMP = [
  '#cde2fb',
  '#b7d3f6',
  '#9ec5f4',
  '#86b6ef',
  '#6da7ec',
  '#5598e7',
  '#3987e5',
  '#2a78d6',
  '#256abf',
  '#1c5cab',
  '#184f95',
  '#104281',
  '#0d366b',
] as const;

export type ColorMode = 'light' | 'dark';

export type ColorScale = {
  kind: 'log' | 'linear';
  /** Lower and upper end of the scale. */
  domain: [number, number];
  /** Values to label on the legend, inside the domain. */
  ticks: number[];
  /** Colour for a value; `null` for a missing value. */
  color: (value: number | null | undefined) => string | null;
  /** Colours sampled along the scale, low to high, for the legend bar. */
  samples: string[];
  /** Position of a value along the legend, 0-1. */
  position: (value: number) => number;
};

function ramp(mode: ColorMode): (t: number) => string {
  // On a dark surface the low end recedes into the surface, so the ramp flips.
  const colors = mode === 'dark' ? [...RAMP].reverse() : [...RAMP];
  const stops = colors.map((_, index) => index / (colors.length - 1));
  const scale = scaleLinear<string>().domain(stops).range(colors).clamp(true);
  return (t) => scale(t);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Build the scale for one indicator from every value it must cover (all years
 * of the current view), so that a colour means the same in every year.
 */
export function buildColorScale(
  field: MeasureField,
  values: readonly (number | null)[],
  mode: ColorMode,
): ColorScale {
  const present = values.filter((value): value is number => value !== null);
  const toColor = ramp(mode);
  let kind: ColorScale['kind'];
  let domain: [number, number];
  let ticks: number[];
  let position: (value: number) => number;

  if (isRatioField(field)) {
    kind = 'linear';
    // Shares run to 100%; the rate scale ends at the next 10% above the data.
    const top =
      field === 'mev_share' ? 1 : Math.max(0.1, Math.ceil(Math.max(0, ...present) * 10) / 10);
    domain = [0, top];
    ticks = [0, top / 2, top];
    position = (value) => clamp01(value / top);
  } else {
    kind = 'log';
    const positive = present.filter((value) => value > 0);
    const low = positive.length ? Math.floor(Math.log10(Math.min(...positive))) : 0;
    const high = Math.max(low + 1, positive.length ? Math.ceil(Math.log10(Math.max(...positive))) : 1);
    domain = [10 ** low, 10 ** high];
    ticks = Array.from({ length: high - low + 1 }, (_, index) => 10 ** (low + index));
    position = (value) => (value > 0 ? clamp01((Math.log10(value) - low) / (high - low)) : 0);
  }

  return {
    kind,
    domain,
    ticks,
    position,
    color: (value) => (value === null || value === undefined ? null : toColor(position(value))),
    samples: Array.from({ length: 24 }, (_, index) => toColor(index / 23)),
  };
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(color) ?? /^rgb\((\d+), ?(\d+), ?(\d+)\)$/.exec(color);
  if (!match) return 1;
  const [red, green, blue] =
    match.length === 2
      ? [0, 2, 4].map((start) => parseInt(match[1]!.slice(start, start + 2), 16))
      : match.slice(1, 4).map(Number);
  return 0.2126 * channel(red!) + 0.7152 * channel(green!) + 0.0722 * channel(blue!);
}

/** Text colour (white or near-black) with the higher contrast on a fill. */
export function inkOn(fill: string): '#ffffff' | '#0b0b0b' {
  const fillLuminance = luminance(fill);
  const onWhite = 1.05 / (fillLuminance + 0.05);
  const onBlack = (fillLuminance + 0.05) / (luminance('#0b0b0b') + 0.05);
  return onWhite >= onBlack ? '#ffffff' : '#0b0b0b';
}
