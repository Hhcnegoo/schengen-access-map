import { geoArea, geoCentroid, geoOrthographic } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, MultiLineString, Polygon } from 'geojson';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

/** Side of the square globe drawing in SVG user units. */
export const GLOBE_SIZE = 600;

/** Projection scale at which the whole globe fits the drawing. */
export const BASE_SCALE = GLOBE_SIZE / 2 - 8;

/** Zoom limits relative to the whole-globe view. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 14;

/** Share of the drawing a country fills when the globe zooms in on it. */
const FOCUS_FILL = 0.62;

/** What the globe looks at: the point at its centre and the zoom factor. */
export type GlobeView = {
  /** Longitude and latitude at the centre of the disc. */
  centre: [number, number];
  /** 1 shows the whole hemisphere. */
  zoom: number;
};

/** One country of the atlas with what the globe needs to frame it. */
export type GlobeCountry = {
  /** ISO 3166-1 numeric code; empty for shapes without one. */
  id: string;
  shape: Feature<Geometry>;
  /** View that centres and frames the country's largest landmass. */
  focus: GlobeView;
};

/** Coastlines and borders at one level of detail. */
export type GlobeBase = {
  land: GeoPermissibleObjects;
  borders: MultiLineString;
};

export type GlobeAtlas = {
  countries: GlobeCountry[];
  /** Full detail, drawn when the globe is at rest. */
  detailed: GlobeBase;
  /** Reduced detail, drawn while the globe moves. */
  coarse: GlobeBase;
};

export function createProjection(view: GlobeView) {
  return geoOrthographic()
    .translate([GLOBE_SIZE / 2, GLOBE_SIZE / 2])
    .clipAngle(90)
    .precision(0.3)
    .rotate([-view.centre[0], -view.centre[1], 0])
    .scale(BASE_SCALE * view.zoom);
}

/**
 * Largest polygon of a country. Overseas territories and remote islands are
 * part of some shapes; centring on the largest landmass keeps the focus where
 * a reader looks for the country.
 */
function mainLandmass(shape: Feature<Geometry>): Feature<Geometry> {
  if (shape.geometry.type !== 'MultiPolygon') return shape;
  const parts = shape.geometry.coordinates.map<Feature<Polygon>>((coordinates) => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates },
  }));
  return parts.reduce((largest, part) => (geoArea(part) > geoArea(largest) ? part : largest));
}

/** View that centres a country and scales it to fill part of the drawing. */
export function focusOn(shape: Feature<Geometry>): GlobeView {
  const main = mainLandmass(shape);
  const centre = geoCentroid(main);
  const margin = (GLOBE_SIZE * (1 - FOCUS_FILL)) / 2;
  const fitted = createProjection({ centre, zoom: 1 }).fitExtent(
    [
      [margin, margin],
      [GLOBE_SIZE - margin, GLOBE_SIZE - margin],
    ],
    main,
  );
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitted.scale() / BASE_SCALE));
  return { centre: [centre[0], centre[1]], zoom };
}

function baseOf(topology: Topology): GlobeBase {
  const countries = topology.objects.countries as GeometryCollection;
  return {
    land: feature(topology, topology.objects.land as GeometryCollection),
    borders: mesh(topology, countries, (a, b) => a !== b),
  };
}

/** Prepare the two world-atlas topologies for drawing. */
export function buildAtlas(detailed: Topology, coarse: Topology): GlobeAtlas {
  const collection = feature(
    detailed,
    detailed.objects.countries as GeometryCollection,
  ) as FeatureCollection<Geometry>;
  return {
    countries: collection.features.map((shape) => ({
      id: shape.id === undefined ? '' : String(shape.id),
      shape,
      focus: focusOn(shape),
    })),
    detailed: baseOf(detailed),
    coarse: baseOf(coarse),
  };
}

/** Load the bundled atlas (separate chunks, no request to another origin). */
export async function loadAtlas(): Promise<GlobeAtlas> {
  const [detailed, coarse] = await Promise.all([
    import('world-atlas/countries-50m.json'),
    import('world-atlas/countries-110m.json'),
  ]);
  return buildAtlas(detailed.default, coarse.default);
}
