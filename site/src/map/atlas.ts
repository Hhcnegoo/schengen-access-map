import { geoConicEqualArea, geoPath } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

/** Size of the map drawing in SVG user units. */
export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 540;

/** Frame fitted into the drawing: west, south, east, north (degrees). */
const FRAME = { west: -22, south: 35, east: 140, north: 72 };

/** Projected area (square units) below which a shape also gets a marker. */
const SMALL_SHAPE_AREA = 40;

export type MapShape = {
  /** ISO 3166-1 numeric code; empty for shapes without one. */
  id: string;
  /** SVG path data. */
  path: string;
  /** Point used to anchor a marker or tooltip. */
  centroid: [number, number];
  /** True when the shape is too small to hover or tap reliably. */
  small: boolean;
};

function frameOutline(): GeoPermissibleObjects {
  const { west, south, east, north } = FRAME;
  const middle = (west + east) / 2;
  return {
    type: 'MultiPoint',
    coordinates: [
      [west, south],
      [middle, south],
      [east, south],
      [east, north],
      [middle, north],
      [west, north],
    ],
  };
}

export function createProjection() {
  return geoConicEqualArea()
    .parallels([42, 64])
    .rotate([-48, 0])
    .fitExtent(
      [
        [8, 8],
        [MAP_WIDTH - 8, MAP_HEIGHT - 8],
      ],
      frameOutline(),
    )
    .clipExtent([
      [0, 0],
      [MAP_WIDTH, MAP_HEIGHT],
    ]);
}

/** Project every country of a world-atlas topology that falls in the frame. */
export function buildShapes(topology: Topology): MapShape[] {
  const countries = topology.objects.countries as GeometryCollection;
  const collection = feature(topology, countries) as FeatureCollection<Geometry>;
  const path = geoPath(createProjection());
  const shapes: MapShape[] = [];
  for (const item of collection.features as Feature<Geometry>[]) {
    const data = path(item);
    if (!data) continue;
    const [x, y] = path.centroid(item);
    shapes.push({
      id: item.id === undefined ? '' : String(item.id),
      path: data,
      centroid: [x, y],
      small: path.area(item) < SMALL_SHAPE_AREA,
    });
  }
  return shapes;
}

/** Load the bundled atlas (a separate chunk, no network request off-site). */
export async function loadShapes(): Promise<MapShape[]> {
  const module = await import('world-atlas/countries-50m.json');
  return buildShapes(module.default);
}
