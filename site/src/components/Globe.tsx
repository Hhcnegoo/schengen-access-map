import { geoDistance, geoGraticule10, geoInterpolate, geoPath } from 'd3-geo';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { BASE_SCALE, GLOBE_SIZE, MAX_ZOOM, MIN_ZOOM, createProjection } from '../map/atlas';
import type { GlobeAtlas, GlobeView } from '../map/atlas';
import type { LabelAnchor } from '../map/labels';
import type { ColorMode, ColorScale } from '../viz/colorScale';

/** One coloured country on the globe. */
export type GlobeRegion = {
  /** ISO 3166-1 numeric code, matching the atlas shape. */
  id: string;
  /** Code passed to `onSelect`. */
  key: string;
  name: string;
  value: number | null;
  /** The value as displayed (already formatted, or the "no data" label). */
  valueText: string;
  label?: LabelAnchor | null;
};

type Props = {
  atlas: GlobeAtlas;
  regions: GlobeRegion[];
  scale: ColorScale;
  mode: ColorMode;
  /** Region drawn with an emphasis outline. */
  selectedId: string | null;
  /** Country outlined for context without being a data region. */
  contextRegion: { id: string; name: string; label?: LabelAnchor | null } | null;
  /** Point the whole-globe view is centred on. */
  home: [number, number];
  ariaLabel: string;
  /** Second line of the tooltip, e.g. "Not issued rate, 2024". */
  tooltipContext: string;
  text: {
    zoomIn: string;
    zoomOut: string;
    reset: string;
    select: (name: string) => string;
  };
  onSelect: (key: string) => void;
};

type Tip = { region: GlobeRegion; x: number; y: number; flip: boolean };
type Point = { x: number; y: number };

/** Time the pointer rests on a country before the globe zooms in on it. */
const HOVER_DELAY_MS = 140;
/** Time after the pointer leaves before the globe shows the whole Earth again. */
const LEAVE_DELAY_MS = 700;
const FLIGHT_MS = 650;
const BUTTON_ZOOM_MS = 260;
const BUTTON_ZOOM_FACTOR = 1.7;
/** Pointer travel that turns a press into a drag. */
const DRAG_THRESHOLD = 4;
/**
 * Pointer travel needed before hovering can move the globe again. The globe
 * shifts under a resting pointer when it zooms; without this, the country
 * that slides under the pointer would start the next zoom by itself.
 */
const REARM_DISTANCE = 8;
/** Projected area below which a country also gets a round marker. */
const SMALL_AREA = 70;
/** Projected area from which a country's name is written on it. */
const LABEL_AREA = 1100;
const MARKER_RADIUS = 5;
const HORIZON = Math.PI / 2 - 0.03;
const GRATICULE = geoGraticule10();
const SPHERE = { type: 'Sphere' } as const;

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function regionIdAt(target: EventTarget | null): string | null {
  return target instanceof Element
    ? (target.closest('[data-region]')?.getAttribute('data-region') ?? null)
    : null;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * The whole Earth as a globe. Resting the pointer on a coloured country (or
 * moving keyboard focus to it) turns and zooms the globe to that country;
 * clicking it reports the selection. The globe can be dragged, and zooms out
 * again when the pointer leaves.
 *
 * Coastlines are painted on a canvas; the coloured countries are SVG shapes
 * so that they can be hovered, focused and clicked. Positions are written
 * straight to the elements on every frame, outside React rendering.
 */
export function Globe({
  atlas,
  regions,
  scale,
  mode,
  selectedId,
  contextRegion,
  home,
  ariaLabel,
  tooltipContext,
  text,
  onSelect,
}: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const regionPaths = useRef(new Map<string, SVGPathElement>());
  const markers = useRef(new Map<string, SVGGElement>());
  const labels = useRef(new Map<string, SVGTextElement>());
  const selectedPath = useRef<SVGPathElement>(null);
  const contextPath = useRef<SVGPathElement>(null);

  const view = useRef<GlobeView>({ centre: [home[0], home[1]], zoom: 1 });
  const flight = useRef(0);
  const flying = useRef(false);
  const focusedId = useRef<string | null>(null);
  const pointer = useRef<Point | null>(null);
  const restingAt = useRef<Point | null>(null);
  const hover = useRef<{ id: string; timer: number } | null>(null);
  const leaveTimer = useRef(0);
  const settleTimer = useRef(0);
  const drag = useRef<(Point & { moved: boolean }) | null>(null);
  const suppressClick = useRef(false);

  const [tip, setTip] = useState<Tip | null>(null);

  const countryById = useMemo(
    () => new Map(atlas.countries.map((country) => [country.id, country])),
    [atlas],
  );
  const regionById = useMemo(() => new Map(regions.map((region) => [region.id, region])), [regions]);
  const labelled = useMemo(
    () => [
      ...regions.flatMap((region) =>
        region.label ? [{ id: region.id, name: region.name, anchor: region.label }] : [],
      ),
      ...(contextRegion?.label
        ? [{ id: contextRegion.id, name: contextRegion.name, anchor: contextRegion.label }]
        : []),
    ],
    [regions, contextRegion],
  );

  // What the drawing code needs from the latest render.
  const scene = useRef({ regions, labelled, selectedId, contextId: contextRegion?.id ?? null });
  scene.current = { regions, labelled, selectedId, contextId: contextRegion?.id ?? null };

  /** Place the interactive shapes, markers and labels for the current view. */
  const drawShapes = useCallback(() => {
    const current = view.current;
    const projection = createProjection(current).clipExtent([
      [0, 0],
      [GLOBE_SIZE, GLOBE_SIZE],
    ]);
    const path = geoPath(projection);
    const { regions: shown, labelled: names, selectedId: selected, contextId } = scene.current;

    for (const region of shown) {
      const country = countryById.get(region.id);
      if (!country) continue;
      regionPaths.current.get(region.id)?.setAttribute('d', path(country.shape) ?? '');
      const marker = markers.current.get(region.id);
      if (!marker) continue;
      const facing = geoDistance(country.focus.centre, current.centre) < HORIZON;
      const point = facing ? projection(country.focus.centre) : null;
      if (point && path.area(country.shape) < SMALL_AREA) {
        marker.setAttribute('transform', `translate(${point[0]},${point[1]})`);
        marker.style.display = '';
      } else {
        marker.style.display = 'none';
      }
    }

    const selectedShape = selected ? countryById.get(selected)?.shape : undefined;
    selectedPath.current?.setAttribute('d', (selectedShape && path(selectedShape)) ?? '');
    const contextShape = contextId ? countryById.get(contextId)?.shape : undefined;
    contextPath.current?.setAttribute('d', (contextShape && path(contextShape)) ?? '');

    // Names appear once a country is large enough on screen, so that the
    // labels of small neighbours do not overlap on the whole-globe view. The
    // single context country is always named.
    for (const { id, anchor } of names) {
      const element = labels.current.get(id);
      const shape = countryById.get(id)?.shape;
      if (!element || !shape) continue;
      const roomy = id === contextId || path.area(shape) >= LABEL_AREA;
      const facing = geoDistance(anchor.at, current.centre) < HORIZON;
      const point = roomy && facing ? projection(anchor.at) : null;
      if (point) {
        element.setAttribute('x', String(point[0]));
        element.setAttribute('y', String(point[1]));
        element.style.display = '';
      } else {
        element.style.display = 'none';
      }
    }
  }, [countryById]);

  /** Paint ocean, graticule, land and borders. */
  const drawBase = useCallback(
    (detailed: boolean) => {
      const element = canvas.current;
      const context = element?.getContext?.('2d');
      if (!element || !context || !frame.current) return;
      const styles = getComputedStyle(frame.current);
      const colour = (name: string) => styles.getPropertyValue(name).trim();
      const ratio = element.width / GLOBE_SIZE;
      const base = detailed ? atlas.detailed : atlas.coarse;
      const projection = createProjection(view.current).clipExtent([
        [0, 0],
        [GLOBE_SIZE, GLOBE_SIZE],
      ]);
      const path = geoPath(projection, context);

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, GLOBE_SIZE, GLOBE_SIZE);
      context.lineJoin = 'round';

      context.beginPath();
      path(SPHERE);
      context.fillStyle = colour('--globe-ocean');
      context.fill();

      context.beginPath();
      path(GRATICULE);
      context.lineWidth = 0.5;
      context.strokeStyle = colour('--globe-graticule');
      context.stroke();

      context.beginPath();
      path(base.land);
      context.fillStyle = colour('--map-land');
      context.fill();

      context.beginPath();
      path(base.borders);
      context.lineWidth = 0.6;
      context.strokeStyle = colour('--globe-border');
      context.stroke();

      context.beginPath();
      path(SPHERE);
      context.lineWidth = 1;
      context.strokeStyle = colour('--axis');
      context.stroke();
    },
    [atlas],
  );

  const draw = useCallback(
    (detailed: boolean) => {
      drawShapes();
      drawBase(detailed);
    },
    [drawShapes, drawBase],
  );

  /** Turn and zoom the globe to a view, then run `whenDone`. */
  const flyTo = useCallback(
    (target: GlobeView, duration = FLIGHT_MS, whenDone?: () => void) => {
      cancelAnimationFrame(flight.current);
      window.clearTimeout(settleTimer.current);
      const from = view.current;
      const finish = () => {
        view.current = target;
        flying.current = false;
        restingAt.current = pointer.current;
        draw(true);
        whenDone?.();
      };
      if (duration === 0 || prefersReducedMotion()) {
        finish();
        return;
      }
      const along = geoInterpolate(from.centre, target.centre);
      const start = performance.now();
      flying.current = true;
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        if (progress >= 1) {
          finish();
          return;
        }
        const eased = easeInOut(progress);
        const [longitude, latitude] = along(eased);
        view.current = {
          centre: [longitude, latitude],
          zoom: from.zoom * (target.zoom / from.zoom) ** eased,
        };
        draw(false);
        flight.current = requestAnimationFrame(step);
      };
      flight.current = requestAnimationFrame(step);
    },
    [draw],
  );

  const flyHome = useCallback(() => {
    focusedId.current = null;
    flyTo({ centre: [home[0], home[1]], zoom: 1 });
  }, [flyTo, home]);

  const focusRegion = useCallback(
    (id: string) => {
      const country = countryById.get(id);
      if (!country || focusedId.current === id) return;
      focusedId.current = id;
      flyTo(country.focus);
    },
    [countryById, flyTo],
  );

  const clearHover = useCallback(() => {
    if (hover.current) window.clearTimeout(hover.current.timer);
    hover.current = null;
  }, []);

  // Size the canvas to its box and the screen's pixel density.
  useEffect(() => {
    const box = frame.current;
    const element = canvas.current;
    if (!box || !element) return undefined;
    const resize = () => {
      const side = Math.max(1, Math.round(box.clientWidth * (window.devicePixelRatio || 1)));
      if (element.width !== side) {
        element.width = side;
        element.height = side;
      }
      // Keep names legible when the drawing is scaled down on a small screen.
      const shrink = GLOBE_SIZE / Math.max(1, box.clientWidth);
      box.style.setProperty('--label-size', `${12 * Math.max(1, shrink)}px`);
      draw(!flying.current);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    resize();
    return () => observer.disconnect();
  }, [draw]);

  // Shapes follow the data shown; the canvas only depends on theme and view.
  useLayoutEffect(() => {
    drawShapes();
  }, [drawShapes, regions, selectedId, contextRegion]);

  useEffect(() => {
    drawBase(!flying.current);
  }, [drawBase, mode]);

  // A new default centre (the other map view) brings the whole globe back.
  const firstHome = useRef(true);
  useEffect(() => {
    if (firstHome.current) {
      firstHome.current = false;
      return;
    }
    flyHome();
  }, [flyHome]);

  useEffect(
    () => () => {
      cancelAnimationFrame(flight.current);
      window.clearTimeout(leaveTimer.current);
      window.clearTimeout(settleTimer.current);
      clearHover();
    },
    [clearHover],
  );

  function tipAt(region: GlobeRegion, x: number, y: number) {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ region, x: x - box.left, y: y - box.top, flip: x - box.left > box.width * 0.6 });
  }

  function rotateBy(dx: number, dy: number) {
    const current = view.current;
    const degreesPerUnit = 180 / (Math.PI * BASE_SCALE * current.zoom);
    const unitsPerPixel = GLOBE_SIZE / (frame.current?.clientWidth || GLOBE_SIZE);
    const longitude = current.centre[0] - dx * unitsPerPixel * degreesPerUnit;
    const latitude = current.centre[1] + dy * unitsPerPixel * degreesPerUnit;
    view.current = {
      centre: [((((longitude + 180) % 360) + 360) % 360) - 180, Math.max(-85, Math.min(85, latitude))],
      zoom: current.zoom,
    };
    draw(false);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => drawBase(true), 160);
  }

  function onPointerDown(event: PointerEvent) {
    suppressClick.current = false;
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
  }

  function onPointerMove(event: PointerEvent) {
    pointer.current = { x: event.clientX, y: event.clientY };
    window.clearTimeout(leaveTimer.current);

    const pressed = drag.current;
    if (pressed && event.buttons !== 0) {
      const dx = event.clientX - pressed.x;
      const dy = event.clientY - pressed.y;
      if (!pressed.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!pressed.moved) {
        cancelAnimationFrame(flight.current);
        flying.current = false;
        focusedId.current = null;
        clearHover();
        setTip(null);
      }
      drag.current = { x: event.clientX, y: event.clientY, moved: true };
      rotateBy(dx, dy);
      return;
    }

    const id = regionIdAt(event.target);
    const region = id ? regionById.get(id) : undefined;
    if (region) tipAt(region, event.clientX, event.clientY);
    else setTip(null);

    // Hovering zooms in only after the pointer has really moved since the
    // globe last came to rest.
    const rest = restingAt.current;
    if (rest) {
      if (Math.hypot(event.clientX - rest.x, event.clientY - rest.y) < REARM_DISTANCE) return;
      restingAt.current = null;
    }
    // Touch has no hover: a tap focuses and selects.
    if (event.pointerType === 'touch' || !id || !region || id === focusedId.current) {
      clearHover();
      return;
    }
    if (flying.current || hover.current?.id === id) return;
    clearHover();
    hover.current = {
      id,
      timer: window.setTimeout(() => {
        hover.current = null;
        focusRegion(id);
      }, HOVER_DELAY_MS),
    };
  }

  function endDrag() {
    if (drag.current?.moved) {
      suppressClick.current = true;
      restingAt.current = pointer.current;
      window.clearTimeout(settleTimer.current);
      draw(true);
    }
    drag.current = null;
  }

  function onPointerLeave(event: PointerEvent) {
    endDrag();
    clearHover();
    setTip(null);
    // Lifting a finger also "leaves"; a touch view stays until reset or a tap
    // outside the coloured countries.
    if (event.pointerType === 'touch') return;
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      restingAt.current = null;
      flyHome();
    }, LEAVE_DELAY_MS);
  }

  function onClick(event: MouseEvent) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const id = regionIdAt(event.target);
    const region = id ? regionById.get(id) : undefined;
    if (!id || !region) {
      flyHome();
      return;
    }
    clearHover();
    focusRegion(id);
    onSelect(region.key);
  }

  function onKeyDown(event: KeyboardEvent, region: GlobeRegion) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(region.key);
    }
  }

  function zoomBy(factor: number) {
    focusedId.current = null;
    flyTo(
      { centre: view.current.centre, zoom: clampZoom(view.current.zoom * factor) },
      BUTTON_ZOOM_MS,
    );
  }

  function setRef<T>(store: Map<string, T>, id: string) {
    return (element: T | null) => {
      if (element) store.set(id, element);
      else store.delete(id);
    };
  }

  return (
    <div
      className="globe-frame"
      ref={frame}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={onPointerLeave}
    >
      <canvas ref={canvas} className="globe-canvas" aria-hidden="true" />
      <svg
        className="globe-shapes"
        viewBox={`0 0 ${GLOBE_SIZE} ${GLOBE_SIZE}`}
        role="group"
        aria-label={ariaLabel}
        onClick={onClick}
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

        <path ref={contextPath} className="map-context" aria-hidden="true" />

        <g>
          {regions.map((region) => (
            <path
              key={region.id}
              ref={setRef(regionPaths.current, region.id)}
              data-region={region.id}
              className="map-region"
              fill={scale.color(region.value) ?? 'url(#map-no-data)'}
              tabIndex={0}
              role="button"
              aria-label={`${text.select(region.name)}. ${tooltipContext}: ${region.valueText}`}
              onFocus={() => focusRegion(region.id)}
              onKeyDown={(event) => onKeyDown(event, region)}
            />
          ))}
        </g>

        <g aria-hidden="true">
          {regions.map((region) => (
            <g key={region.id} ref={setRef(markers.current, region.id)} style={{ display: 'none' }}>
              <circle
                r={MARKER_RADIUS}
                className="map-marker"
                fill={scale.color(region.value) ?? 'url(#map-no-data)'}
              />
              <circle r={MARKER_RADIUS * 2.4} className="map-marker-hit" data-region={region.id} />
            </g>
          ))}
        </g>

        <path ref={selectedPath} className="map-selected" aria-hidden="true" />

        <g aria-hidden="true" className="map-labels">
          {labelled.map(({ id, name, anchor }) => (
            <text key={id} ref={setRef(labels.current, id)} textAnchor={anchor.align}>
              {name}
            </text>
          ))}
        </g>
      </svg>

      <div className="globe-buttons">
        <button type="button" aria-label={text.zoomIn} title={text.zoomIn} onClick={() => zoomBy(BUTTON_ZOOM_FACTOR)}>
          +
        </button>
        <button type="button" aria-label={text.zoomOut} title={text.zoomOut} onClick={() => zoomBy(1 / BUTTON_ZOOM_FACTOR)}>
          −
        </button>
        <button type="button" aria-label={text.reset} title={text.reset} onClick={flyHome}>
          ⟲
        </button>
      </div>

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
