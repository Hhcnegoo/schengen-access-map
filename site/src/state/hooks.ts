import { useCallback, useEffect, useState } from 'react';
import type { Dataset } from '../data/dataset';
import type { GlobeAtlas } from '../map/atlas';
import { loadAtlas } from '../map/atlas';
import type { ColorMode } from '../viz/colorScale';
import { parseViewState, serializeViewState } from './viewState';
import type { ViewState } from './viewState';

/** View state kept in the URL hash, so that a view can be linked to. */
export function useViewState(dataset: Dataset): [ViewState, (patch: Partial<ViewState>) => void] {
  const read = useCallback(
    () => parseViewState(window.location.hash, dataset, window.navigator.languages ?? []),
    [dataset],
  );
  const [state, setState] = useState<ViewState>(read);

  useEffect(() => {
    const onHashChange = () => setState(read());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [read]);

  useEffect(() => {
    const hash = serializeViewState(state);
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
    document.documentElement.lang = state.locale;
  }, [state]);

  const update = useCallback((patch: Partial<ViewState>) => {
    setState((previous) => ({ ...previous, ...patch }));
  }, []);
  return [state, update];
}

/** Follow the operating system's light or dark setting. */
export function useColorMode(): ColorMode {
  const query =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
  const [mode, setMode] = useState<ColorMode>(query?.matches ? 'dark' : 'light');
  useEffect(() => {
    if (!query) return undefined;
    const onChange = (event: MediaQueryListEvent) => setMode(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [query]);
  return mode;
}

export type AtlasState =
  | { status: 'loading' }
  | { status: 'ready'; atlas: GlobeAtlas }
  | { status: 'error' };

/** Load the bundled atlas once. */
export function useAtlas(): AtlasState {
  const [state, setState] = useState<AtlasState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    loadAtlas()
      .then((atlas) => {
        if (!cancelled) setState({ status: 'ready', atlas });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
