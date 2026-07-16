// Committed per-site smoke manifest. `tests/smoke/pages.spec.ts` iterates this
// list, asserting each route returns its expected status and paints a hydration
// marker with no console errors. This ships the SAFE DEFAULT every reddoor-starter
// clone inherits; each site's figma-slices build grows the list as real routes
// land (add `{ path, name, hydrationMarker }` entries).
//
// NOTE on the default `/` entry: it expects 200, which holds once the clone is
// wired to a real Prismic repo (getByUID("page","home") resolves). On the bare
// placeholder starter, `/` returns 404 (the Prismic lookup throws → error(404)),
// so the `/` case only goes green after Prismic is wired — by design, since the
// gate is about real site health. The hydration marker `footer` is the shared
// layout footer, present on every page including the error page.

export type SmokeRoute = {
  /** Route path to visit, e.g. "/" or "/about". */
  path: string;
  /** Human-readable label used in the test title. */
  name: string;
  /** CSS selector asserted visible after load (hydration proof). Default: skip. */
  hydrationMarker?: string;
  /** Expected HTTP status. Default: 200. */
  expectStatus?: number;
};

export const smokeRoutes: SmokeRoute[] = [
  { path: "/", name: "home", hydrationMarker: "footer" },
];
