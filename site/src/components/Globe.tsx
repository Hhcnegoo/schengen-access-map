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

type Point = { x: number; y: number };
type Flight = { duration?: number; ease?: (t: number) => number; whenDone?: () => void };

/** Time the pointer rests on a country before the globe zooms in on it. */
const HOVER_DELAY_MS = 140;
/** Time after the pointer leaves before the globe shows the whole Earth again. */
const LEAVE_DELAY_MS = 650;
const FOCUS_MS = 900;
const HOME_MS = 1000;
const ENTRANCE_MS = 1700;
const BUTTON_ZOOM_MS = 320;
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
const MARKER_RADIUS = 4.5;
/** Angle from the centre beyond which a point is on the far side. */
const HORIZON = Math.PI / 2 - 0.03;
/** How quickly a released globe slows down (time constant). */
const GLIDE_MS = 340;
/** Slowest turn, in degrees per millisecond, that still glides after release. */
const GLIDE_MIN_SPEED = 0.012;
const GRATICULE = geoGraticule10();
const CENTRE = GLOBE_SIZE / 2;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 4;

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function wrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
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
 * clicking it reports the selection. The globe can be dragged, glides on
 * release, and shows the whole Earth again when the pointer leaves.
 *
 * The globe is a round lens of fixed size: zooming magnifies what is inside
 * it. Coastlines are painted on a canvas; the coloured countries are SVG
 * shapes so that they can be hovered, focused and clicked. Positions are
 * written straight to the elements on every frame, outside React rendering.
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
  const tooltip = useRef<HTMLDivElement>(null);
  const regionPaths = useRef(new Map<string, SVGPathElement>());
  const markers = useRef(new Map<string, SVGGElement>());
  const labels = useRef(new Map<string, SVGTextElement>());
  const selectedPath = useRef<SVGPathElement>(null);
  const contextPath = useRef<SVGPathElement>(null);

  const reducedMotion = useMemo(prefersReducedMotion, []);
  // The globe turns into place when it first appears.
  const view = useRef<GlobeView>({
    centre: reducedMotion ? [home[0], home[1]] : [wrapLongitude(home[0] - 70), home[1] - 12],
    zoom: 1,
  });
  const animation = useRef(0);
  const flying = useRef(false);
  const focusedId = useRef<string | null>(null);
  const pointer = useRef<Point | null>(null);
  const restingAt = useRef<Point | null>(null);
  const hover = useRef<{ id: string; timer: number } | null>(null);
  const leaveTimer = useRef(0);
  const settleTimer = useRef(0);
  const drag = useRef<(Point & { moved: boolean; time: number }) | null>(null);
  const velocity = useRef({ longitude: 0, latitude: 0 });
  const suppressClick = useRef(false);

  const [hovered, setHovered] = useState<GlobeRegion | null>(null);

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
    const areas = new Map<string, number>();

    for (const region of shown) {
      const country = countryById.get(region.id);
      if (!country) continue;
      regionPaths.current.get(region.id)?.setAttribute('d', path(country.shape) ?? '');
      const area = path.area(country.shape);
      areas.set(region.id, area);
      const marker = markers.current.get(region.id);
      if (!marker) continue;
      const facing = geoDistance(country.focus.centre, current.centre) < HORIZON;
      const point = facing ? projection(country.focus.centre) : null;
      if (point && area < SMALL_AREA) {
        marker.setAttribute('transform', `translate(${point[0]},${point[1]})`);
        marker.style.opacity = '1';
      } else {
        marker.style.opacity = '0';
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
      const roomy = id === contextId || (areas.get(id) ?? path.area(shape)) >= LABEL_AREA;
      const facing = geoDistance(anchor.at, current.centre) < HORIZON;
      const point = roomy && facing ? projection(anchor.at) : null;
      if (point) {
        element.setAttribute('x', String(point[0]));
        element.setAttribute('y', String(point[1]));
        element.style.opacity = '1';
      } else {
        element.style.opacity = '0';
      }
    }
  }, [countryById]);

  /** Paint graticule, land and borders; the ocean is the lens background. */
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
      path(GRATICULE);
      context.lineWidth = 0.6;
      context.strokeStyle = colour('--globe-graticule');
      context.stroke();

      context.beginPath();
      path(base.land);
      context.fillStyle = colour('--globe-land');
      context.fill();

      context.beginPath();
      path(base.borders);
      context.lineWidth = 0.7;
      context.strokeStyle = colour('--globe-border');
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

  const stopMotion = useCallback(() => {
    cancelAnimationFrame(animation.current);
    window.clearTimeout(settleTimer.current);
    flying.current = false;
  }, []);

  /** Turn and zoom the globe to a view. */
  const flyTo = useCallback(
    (target: GlobeView, { duration = FOCUS_MS, ease = easeInOut, whenDone }: Flight = {}) => {
      stopMotion();
      const from = view.current;
      const finish = () => {
        view.current = target;
        flying.current = false;
        restingAt.current = pointer.current;
        draw(true);
        whenDone?.();
      };
      if (duration === 0 || reducedMotion) {
        finish();
        return;
      }
      const along = geoInterpolate(from.centre, target.centre);
      // Between two close-up views the globe pulls back on the way, so that
      // the turn stays readable.
      const pullBack =
        0.4 *
        Math.min(1, geoDistance(from.centre, target.centre) / 0.9) *
        Math.min(1, Math.max(0, Math.min(from.zoom, target.zoom) - 1) / 1.5);
      const start = performance.now();
      flying.current = true;
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        if (progress >= 1) {
          finish();
          return;
        }
        const eased = ease(progress);
        const [longitude, latitude] = along(eased);
        const direct = from.zoom * (target.zoom / from.zoom) ** eased;
        view.current = {
          centre: [longitude, latitude],
          zoom: Math.max(MIN_ZOOM, direct * (1 - pullBack * Math.sin(Math.PI * eased))),
        };
        draw(false);
        animation.current = requestAnimationFrame(step);
      };
      animation.current = requestAnimationFrame(step);
    },
    [draw, reducedMotion, stopMotion],
  );

  const flyHome = useCallback(() => {
    focusedId.current = null;
    flyTo({ centre: [home[0], home[1]], zoom: 1 }, { duration: HOME_MS });
  }, [flyTo, home]);

  const focusRegion = useCallback(
    (id: string) => {
      const country = countryById.get(id);
      if (!country || focusedId.current === id) return;
      focusedId.current = id;
      flyTo(country.focus, { ease: easeOut });
    },
    [countryById, flyTo],
  );

  /** Let a released globe keep turning and slow down. */
  const glide = useCallback(() => {
    const speed = Math.hypot(velocity.current.longitude, velocity.current.latitude);
    if (reducedMotion || speed < GLIDE_MIN_SPEED) {
      draw(true);
      return;
    }
    flying.current = true;
    let last = performance.now();
    const step = (now: number) => {
      const elapsed = now - last;
      last = now;
      const decay = Math.exp(-elapsed / GLIDE_MS);
      velocity.current.longitude *= decay;
      velocity.current.latitude *= decay;
      const current = view.current;
      view.current = {
        centre: [
          wrapLongitude(current.centre[0] + velocity.current.longitude * elapsed),
          Math.max(-85, Math.min(85, current.centre[1] + velocity.current.latitude * elapsed)),
        ],
        zoom: current.zoom,
      };
      if (Math.hypot(velocity.current.longitude, velocity.current.latitude) < GLIDE_MIN_SPEED / 4) {
        flying.current = false;
        restingAt.current = pointer.current;
        draw(true);
        return;
      }
      draw(false);
      animation.current = requestAnimationFrame(step);
    };
    animation.current = requestAnimationFrame(step);
  }, [draw, reducedMotion]);

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

  // Turn into place on arrival; a new default centre (the other map view)
  // brings the whole globe back.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) {
      flyHome();
      return;
    }
    arrived.current = true;
    flyTo({ centre: [home[0], home[1]], zoom: 1 }, { duration: ENTRANCE_MS, ease: easeOut });
  }, [flyHome, flyTo, home]);

  useEffect(
    () => () => {
      cancelAnimationFrame(animation.current);
      window.clearTimeout(leaveTimer.current);
      window.clearTimeout(settleTimer.current);
      clearHover();
    },
    [clearHover],
  );

  function placeTooltip(x: number, y: number) {
    const box = frame.current?.getBoundingClientRect();
    const element = tooltip.current;
    if (!box || !element) return;
    const left = x - box.left;
    const flip = left > box.width * 0.58;
    element.style.transform = `translate3d(${left}px, ${y - box.top}px, 0) translate(${
      flip ? 'calc(-100% - 14px)' : '14px'
    }, 14px)`;
  }

  function rotateBy(dx: number, dy: number, elapsed: number) {
    const current = view.current;
    const degreesPerUnit = 180 / (Math.PI * BASE_SCALE * current.zoom);
    const unitsPerPixel = GLOBE_SIZE / (frame.current?.clientWidth || GLOBE_SIZE);
    const turn = {
      longitude: -dx * unitsPerPixel * degreesPerUnit,
      latitude: dy * unitsPerPixel * degreesPerUnit,
    };
    view.current = {
      centre: [
        wrapLongitude(current.centre[0] + turn.longitude),
        Math.max(-85, Math.min(85, current.centre[1] + turn.latitude)),
      ],
      zoom: current.zoom,
    };
    if (elapsed > 0) {
      // Blend with the previous sample so that one jittery move does not set the glide.
      velocity.current = {
        longitude: 0.6 * (turn.longitude / elapsed) + 0.4 * velocity.current.longitude,
        latitude: 0.6 * (turn.latitude / elapsed) + 0.4 * velocity.current.latitude,
      };
    }
    draw(false);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => drawBase(true), 160);
  }

  function onPointerDown(event: PointerEvent) {
    suppressClick.current = false;
    if (event.button !== 0 || (event.target as Element).closest('button')) return;
    drag.current = { x: event.clientX, y: event.clientY, moved: false, time: event.timeStamp };
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
        stopMotion();
        velocity.current = { longitude: 0, latitude: 0 };
        focusedId.current = null;
        clearHover();
        setHovered(null);
      }
      const elapsed = event.timeStamp - pressed.time;
      drag.current = { x: event.clientX, y: event.clientY, moved: true, time: event.timeStamp };
      rotateBy(dx, dy, elapsed);
      return;
    }

    const id = regionIdAt(event.target);
    const region = id ? regionById.get(id) : undefined;
    setHovered(region ?? null);
    if (region) placeTooltip(event.clientX, event.clientY);

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

  function endDrag(event: PointerEvent) {
    const pressed = drag.current;
    drag.current = null;
    if (!pressed?.moved) return;
    suppressClick.current = true;
    restingAt.current = pointer.current;
    window.clearTimeout(settleTimer.current);
    // A pause before release means the globe was set down, not thrown.
    if (event.timeStamp - pressed.time > 90) velocity.current = { longitude: 0, latitude: 0 };
    glide();
  }

  function onPointerLeave(event: PointerEvent) {
    endDrag(event);
    clearHover();
    setHovered(null);
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
      { duration: BUTTON_ZOOM_MS },
    );
  }

  function setRef<T>(store: Map<string, T>, id: string) {
    return (element: T | null) => {
      if (element) store.set(id, element);
      else store.delete(id);
    };
  }

  const fillOf = (region: GlobeRegion) => scale.color(region.value) ?? 'url(#globe-no-data)';

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
      <div className="globe-halo" aria-hidden="true" />
      <div className="globe-ocean" aria-hidden="true" />
      <canvas ref={canvas} className="globe-canvas" aria-hidden="true" />
      <svg
        className="globe-shapes"
        viewBox={`0 0 ${GLOBE_SIZE} ${GLOBE_SIZE}`}
        role="group"
        aria-label={ariaLabel}
        onClick={onClick}
      >
        <defs>
          <clipPath id="globe-lens">
            <circle cx={CENTRE} cy={CENTRE} r={BASE_SCALE} />
          </clipPath>
          <pattern
            id="globe-no-data"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" className="map-no-data-ground" />
            <line x1="0" y1="0" x2="0" y2="6" className="map-no-data-line" />
          </pattern>
          {/* Light from the upper left and a darker rim give the disc its roundness. */}
          <radialGradient id="globe-shade" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.64" className="globe-shade-centre" />
            <stop offset="0.89" className="globe-shade-mid" />
            <stop offset="1" className="globe-shade-rim" />
          </radialGradient>
          <radialGradient id="globe-light" cx="0.32" cy="0.26" r="0.62">
            <stop offset="0" className="globe-light-near" />
            <stop offset="1" className="globe-light-far" />
          </radialGradient>
        </defs>

        <g clipPath="url(#globe-lens)">
          <path ref={contextPath} className="map-context" aria-hidden="true" />
          <g>
            {regions.map((region) => (
              <path
                key={region.id}
                ref={setRef(regionPaths.current, region.id)}
                data-region={region.id}
                className="map-region"
                style={{ fill: fillOf(region) }}
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
              <g
                key={region.id}
                ref={setRef(markers.current, region.id)}
                className="map-marker-group"
                style={{ opacity: 0 }}
              >
                <circle r={MARKER_RADIUS} className="map-marker" style={{ fill: fillOf(region) }} />
                <circle r={MARKER_RADIUS * 2.6} className="map-marker-hit" data-region={region.id} />
              </g>
            ))}
          </g>
          <path ref={selectedPath} className="map-selected" aria-hidden="true" />
        </g>

        <g aria-hidden="true" className="globe-relief">
          <circle cx={CENTRE} cy={CENTRE} r={BASE_SCALE} fill="url(#globe-light)" />
          <circle cx={CENTRE} cy={CENTRE} r={BASE_SCALE} fill="url(#globe-shade)" />
          <circle cx={CENTRE} cy={CENTRE} r={BASE_SCALE - 0.5} className="globe-rim" />
        </g>

        <g aria-hidden="true" className="map-labels" clipPath="url(#globe-lens)">
          {labelled.map(({ id, name, anchor }) => (
            <text
              key={id}
              ref={setRef(labels.current, id)}
              textAnchor={anchor.align}
              style={{ opacity: 0 }}
            >
              {name}
            </text>
          ))}
        </g>
      </svg>

      <div className="globe-buttons">
        <button
          type="button"
          aria-label={text.zoomIn}
          title={text.zoomIn}
          onClick={() => zoomBy(BUTTON_ZOOM_FACTOR)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={text.zoomOut}
          title={text.zoomOut}
          onClick={() => zoomBy(1 / BUTTON_ZOOM_FACTOR)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10" />
          </svg>
        </button>
        <button type="button" aria-label={text.reset} title={text.reset} onClick={flyHome}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" />
            <path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11" />
          </svg>
        </button>
      </div>

      <div
        ref={tooltip}
        className={`tooltip globe-tooltip${hovered ? ' is-visible' : ''}`}
        role="presentation"
      >
        {hovered ? (
          <>
            <strong>{hovered.valueText}</strong>
            <span>{hovered.name}</span>
            <span className="tooltip-context">{tooltipContext}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
