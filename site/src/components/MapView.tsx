import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { MAP_HEIGHT, MAP_WIDTH } from '../map/atlas';
import type { MapShape } from '../map/atlas';
import type { MapLabel } from '../map/labels';
import type { ColorScale } from '../viz/colorScale';

/** One coloured area of the map. */
export type MapRegion = {
  /** ISO 3166-1 numeric code, matching the atlas shape. */
  id: string;
  /** Code passed to `onSelect`. */
  key: string;
  name: string;
  value: number | null;
  /** The value as displayed (already formatted, or the "no data" label). */
  valueText: string;
  label?: MapLabel | null;
};

type Props = {
  shapes: MapShape[];
  regions: MapRegion[];
  scale: ColorScale;
  /** Region drawn with an emphasis outline. */
  selectedId: string | null;
  /** Shape outlined for context without being a data region. */
  contextRegion: { id: string; name: string; label?: MapLabel | null } | null;
  ariaLabel: string;
  /** Second line of the tooltip, e.g. "Not issued rate, 2024". */
  tooltipContext: string;
  onSelect?: (key: string) => void;
  selectLabel?: (name: string) => string;
};

type Tip = { region: MapRegion; x: number; y: number; flip: boolean };

const MARKER_RADIUS = 6;

export function MapView({
  shapes,
  regions,
  scale,
  selectedId,
  contextRegion,
  ariaLabel,
  tooltipContext,
  onSelect,
  selectLabel,
}: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const shapeById = useMemo(() => new Map(shapes.map((shape) => [shape.id, shape])), [shapes]);
  const regionIds = useMemo(() => new Set(regions.map((region) => region.id)), [regions]);
  const drawn = regions.flatMap((region) => {
    const shape = shapeById.get(region.id);
    return shape ? [{ region, shape }] : [];
  });
  const contextShape = contextRegion ? shapeById.get(contextRegion.id) : undefined;

  function showAtPointer(region: MapRegion, event: PointerEvent) {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    const x = event.clientX - box.left;
    setTip({ region, x, y: event.clientY - box.top, flip: x > box.width * 0.6 });
  }

  function showAtShape(region: MapRegion, shape: MapShape) {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    const x = (shape.centroid[0] / MAP_WIDTH) * box.width;
    const y = (shape.centroid[1] / MAP_HEIGHT) * box.height;
    setTip({ region, x, y, flip: x > box.width * 0.6 });
  }

  function onKeyDown(event: KeyboardEvent, region: MapRegion) {
    if (onSelect && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onSelect(region.key);
    }
  }

  function interaction(region: MapRegion, shape: MapShape) {
    return {
      tabIndex: 0,
      role: onSelect ? 'button' : 'img',
      'aria-label': `${
        onSelect && selectLabel ? selectLabel(region.name) : region.name
      }. ${tooltipContext}: ${region.valueText}`,
      onPointerMove: (event: PointerEvent) => showAtPointer(region, event),
      onPointerLeave: () => setTip(null),
      onFocus: () => showAtShape(region, shape),
      onBlur: () => setTip(null),
      onClick: onSelect ? () => onSelect(region.key) : undefined,
      onKeyDown: (event: KeyboardEvent) => onKeyDown(event, region),
    };
  }

  return (
    <div className="map-frame" ref={frame}>
      <svg
        className="map"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="group"
        aria-label={ariaLabel}
      >
        <defs>
          <pattern
            id="map-no-data"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" className="map-no-data-ground" />
            <line x1="0" y1="0" x2="0" y2="6" className="map-no-data-line" />
          </pattern>
        </defs>

        <g aria-hidden="true">
          {shapes
            .filter((shape) => !regionIds.has(shape.id))
            .map((shape, index) => (
              <path key={`${shape.id}-${index}`} d={shape.path} className="map-land" />
            ))}
        </g>

        {contextShape && contextRegion ? (
          <g aria-hidden="true">
            <path d={contextShape.path} className="map-context" />
          </g>
        ) : null}

        <g>
          {drawn.map(({ region, shape }) => (
            <path
              key={region.id}
              d={shape.path}
              className={`map-region${onSelect ? ' is-selectable' : ''}`}
              fill={scale.color(region.value) ?? 'url(#map-no-data)'}
              {...interaction(region, shape)}
            />
          ))}
        </g>

        <g aria-hidden="true">
          {drawn
            .filter(({ shape }) => shape.small)
            .map(({ region, shape }) => (
              <g key={region.id}>
                <circle
                  cx={shape.centroid[0]}
                  cy={shape.centroid[1]}
                  r={MARKER_RADIUS}
                  className="map-marker"
                  fill={scale.color(region.value) ?? 'url(#map-no-data)'}
                />
                <circle
                  cx={shape.centroid[0]}
                  cy={shape.centroid[1]}
                  r={MARKER_RADIUS * 2}
                  className="map-marker-hit"
                  onPointerMove={(event) => showAtPointer(region, event)}
                  onPointerLeave={() => setTip(null)}
                  onClick={onSelect ? () => onSelect(region.key) : undefined}
                />
              </g>
            ))}
        </g>

        <g aria-hidden="true" className="map-outlines">
          {drawn
            .filter(({ region }) => region.id === selectedId)
            .map(({ region, shape }) => (
              <path key={region.id} d={shape.path} className="map-selected" />
            ))}
        </g>

        <g aria-hidden="true" className="map-labels">
          {drawn.map(({ region }) =>
            region.label ? (
              <text
                key={region.id}
                x={region.label.x}
                y={region.label.y}
                textAnchor={region.label.align}
              >
                {region.name}
              </text>
            ) : null,
          )}
          {contextRegion?.label ? (
            <text
              x={contextRegion.label.x}
              y={contextRegion.label.y}
              textAnchor={contextRegion.label.align}
            >
              {contextRegion.name}
            </text>
          ) : null}
        </g>
      </svg>

      {tip ? (
        <div
          className={`tooltip${tip.flip ? ' is-flipped' : ''}`}
          style={{ left: tip.x, top: tip.y }}
          role="presentation"
        >
          <strong>{tip.region.valueText}</strong>
          <span>{tip.region.name}</span>
          <span className="tooltip-context">{tooltipContext}</span>
        </div>
      ) : null}
    </div>
  );
}
