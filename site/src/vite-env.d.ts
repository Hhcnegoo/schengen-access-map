/// <reference types="vite/client" />

// The two JSON files are typed by hand: the data bundle is validated at
// runtime (see data/parse.ts) and the atlas follows the TopoJSON specification.
declare module '@data/site_data.json' {
  const value: unknown;
  export default value;
}

declare module 'world-atlas/countries-50m.json' {
  import type { Topology } from 'topojson-specification';

  const topology: Topology;
  export default topology;
}

declare module 'world-atlas/countries-110m.json' {
  import type { Topology } from 'topojson-specification';

  const topology: Topology;
  export default topology;
}
