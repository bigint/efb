# ADR-0002: Expo New Architecture, MapLibre, and the native boundary

- Status: proposed, with Phase 0 device spike required before acceptance
- Date: 2026-07-14

## Context

The app needs a first-class native map, high-rate location and sensor handling, background
execution, cockpit-readable instruments, and iOS/Android development builds. A WebView map is
prohibited. Library compatibility has changed rapidly: Expo SDK 55 and later are
New-Architecture-only, and MapLibre React Native v11 supports only the New Architecture.

## Decision

Use a stable Expo SDK development build with the React Native New Architecture and Expo Router.
Select `@maplibre/maplibre-react-native` v11 as the primary map renderer, subject to the device
spike below. Use React Native Skia for screen-space instruments, graphs, and bounded
experimental visualizations—not for duplicating the basemap or camera-coupled vector layers.

### Rendering ownership

- MapLibre owns camera transforms, map gestures, basemap/vector/raster tiles, terrain where
  supported, symbols/labels, route geometry, airspace, airports, runways, and other
  world-coordinate layers.
- Skia owns attitude/heading instruments, envelope graphs, weather timelines, and overlays whose
  coordinates are already screen-relative.
- React Native owns controls, sheets, semantic/accessibility trees, and status.
- A single camera state adapter publishes throttled settled/meaningful changes to React.
  Per-frame camera or position animation does not round-trip through a global Zustand store.

This avoids independent renderers drifting a route or warning relative to the map during
pan/zoom/rotation. Any Skia map overlay requires a measured prototype that proves transform
synchronization and accessibility; MapLibre style layers remain the default.

### Native module boundary

Use existing Expo libraries where they meet accuracy, lifecycle, and background requirements.
Build Swift/Kotlin through the Expo Modules API only when a documented capability or performance
gap exists. The `native-platform` public facade exposes versioned contracts such as:

```ts
type PositionSample = Readonly<{
  source: 'device' | 'external' | 'simulator';
  monotonicTimestampMs: number;
  utcTimestampMs: number;
  latitudeDeg: number;
  longitudeDeg: number;
  horizontalAccuracyM: number | null;
  altitudeM: number | null;
  verticalAccuracyM: number | null;
  groundSpeedMps: number | null;
  trueTrackDeg: number | null;
}>;

type SourceStatus = Readonly<{
  permission: 'granted' | 'limited' | 'denied';
  availability: 'current' | 'stale' | 'unavailable';
  lastSampleMonotonicMs: number | null;
  simulated: boolean;
}>;
```

Native code owns subscription setup/teardown, OS permission/lifecycle mapping, sample
timestamping, rate limiting/coalescing, and platform-specific sensor or external GPS protocols.
It does not own route semantics, magnetic/true conversion policy, waypoint sequencing, or UI
wording. Those stay in tested TypeScript domain packages unless profiling demonstrates a hard
need to move a specific algorithm behind a parity-tested interface.

Synchronous native functions are allowed only for bounded constant/snapshot reads measured below
1 ms p99. I/O, data installation, decompression, hashing, and long computation use cancelable
asynchronous APIs off the JS/UI thread.

## Performance budget and validation spike

Before building the vertical slice, test a release development build on a physical baseline
iPad, iPhone, and Android device with:

- MapLibre v11 plus representative local style, route, airport, and airspace density;
  pan/zoom/rotate for 10 minutes at 60 fps target (p95 frame <= 16.7 ms, p99 <= 33.3 ms) with
  bounded native/JS/GPU memory.
- 1/5/10 Hz simulated samples and real foreground/background location; position-to-ownship <=
  100 ms p95 after native receipt and no JS long task over 50 ms.
- rotation, iPad split view, app suspend/resume, process death, permission revocation, GPS
  outage, and low-power/thermal observation.
- offline style/tile loading and attribution/licence display.

Pin the validated Expo SDK and native dependency versions in the lockfile. Upgrade through a
compatibility branch and repeat the native matrix; do not silently float major native versions.

## Failure recovery

- Every source has an independent age threshold and status. On event gaps, lifecycle loss, or
  native errors, transition to stale/unavailable and stop calculations that require current
  samples.
- Preserve last sample only with its timestamp and accuracy. Never relabel it as live or
  extrapolate without explicit dead-reckoning/simulation status.
- If map initialization fails, show a labelled unavailable state while keeping airport/route
  text workflows available; no blank interactive surface.
- Persist a resumable session intent before backgrounding. Relaunch enters a paused/restored
  state until fresh position is acquired and acknowledged.
- Native contract versions are checked at startup; incompatibility blocks the dependent
  capability and generates diagnostics rather than guessing fields.

## Alternatives considered

- **WebView/MapLibre GL JS:** easier web reuse but violates the product mandate and weakens
  native offline/performance integration; rejected.
- **`react-native-maps`:** useful general mapping but less aligned with open-style/tile control
  and New-Architecture-only direction for this product; not selected for the spike.
- **Skia as the entire map engine:** would make tile selection, labels, attribution, offline
  packaging, and platform rendering our responsibility; rejected.
- **Bare React Native without Expo tooling:** provides native control but adds upgrade/build
  burden without a demonstrated capability benefit. Expo development builds already support
  custom native libraries; rejected now.
- **All sensor processing in JavaScript:** increases event pressure and lifecycle risk. Use
  typed/coalesced native acquisition with pure JS domain calculations instead.

## Implementation sequence

1. Set platform floors and build the compatibility/performance spike.
2. Define clock, sample, accuracy, permission, source, simulation, and error contracts with
   native/JS contract tests.
3. Implement map shell and offline fixture style; keep all operational layer transforms in
   MapLibre.
4. Integrate foreground location and simulator through the same facade.
5. Add background behavior only with platform-specific tests and visible lifecycle recovery.
6. Add barometer/attitude/heading and external GPS adapters individually after accuracy and
   power requirements exist.

## References

- [Expo: React Native New Architecture](https://docs.expo.dev/guides/new-architecture/)
- [Expo: development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo Modules API](https://docs.expo.dev/modules/module-api/)
- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
- [Expo TaskManager](https://docs.expo.dev/versions/latest/sdk/task-manager/)
- [MapLibre React Native setup and requirements](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/)
- [MapLibre React Native v11 migration](https://maplibre.org/maplibre-react-native/docs/setup/migrations/v11/)
- [React Native Skia documentation](https://shopify.github.io/react-native-skia/)
