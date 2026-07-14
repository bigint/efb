# Phase 1 design and mobile platform review

Candidate: `e96a2e2` (`feat: add Driftline mobile vertical slice`)

Review roles: Product Design Lead and Mobile Platform Lead

Review date: 2026-07-14

Decision: **BLOCKED for Phase 1 acceptance**

## Scope and evidence boundary

This review covers the committed mobile slice, generated iOS configuration, and the Phase 1
requirements for identity, cockpit readability, information hierarchy, appearance, simulation,
accessibility, adaptive layout, permissions, lifecycle recovery, and native rendering.

The review used source inspection, contrast calculations, a frozen-lock dependency install, a
clean Expo iOS prebuild from a disposable export of `e96a2e2`, and an attempted simulator-target
native build. No iOS Simulator was available and no physical-device testing was performed.
Visual, VoiceOver, Dynamic Type, sunlight, turbulence, battery, frame-pacing,
background-location, and process-death results are therefore `NOT RUN`, not inferred from
source.

## Executive assessment

Driftline has a credible original starting point. The quiet teal and near-black palette, compact
status plane, workspace model, and persistent use of explicit demonstration wording are more
considered than a generic tabbed prototype. The implementation also draws a sensible native
boundary: MapLibre owns geographic content, Skia is limited to an own-ship glyph, and ordinary
React Native views own controls and text.

The slice is not ready for Phase 1 acceptance. One safety-critical defect allows simulation
framing to be switched off while simulated own-ship and plausible navigation values remain
visible. The implemented shell also lacks the documented high-contrast mode, robust Dynamic Type
behavior, split-view compositions, permission states, lifecycle recovery, and the evidence
required for native compatibility. Several cockpit labels are 8 to 11 points, map markers do not
meet the 48-point target, and night-mode primary actions fail contrast.

## Release-blocking findings

| ID    | Priority | Finding                                                                                                                                                                                                                                                                                                                                                                                           | Evidence                                                                                                                                                                                                                                                                                                        | Required disposition                                                                                                                                                                                                                                                                                                                                            |
| ----- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DM-01 | P0       | Simulation identity can be hidden without changing the data source. Disabling `Simulation source` removes the violet frame and changes the status text to `POSITION STANDBY`, but the map still renders the fixture own-ship plus `118 KT` and `4,500 FT GPS`. This creates exactly the real-versus-simulated ambiguity prohibited by the product gates.                                          | `apps/mobile/src/components/SystemWorkspace.tsx:23-28`; `apps/mobile/app/index.tsx:40-50`; `apps/mobile/src/components/StatusPlane.tsx:34-38`; `apps/mobile/src/components/MapWorkspace.tsx:89-90,147-150,163-171`; `apps/mobile/src/store/flight-store.ts:53-57`                                               | Make source identity an invariant. In this slice, simulation must remain on while fixture position is rendered. A future source switch must atomically replace source, values, own-ship treatment, status text, and persistence state. Add an automated state test and manual VoiceOver check.                                                                  |
| DM-02 | P1       | Dynamic Type and cockpit legibility are structurally unproven. Critical overlays use a four-cell row with 70-point minimum-height cells and 8 to 10-point labels; the status and navigation shells use compact minimum heights; the navigation number uses `adjustsFontSizeToFit`, which may shrink a critical value instead of reflowing. There is no font-scale-driven composition.             | `apps/mobile/src/components/MapWorkspace.tsx:200-215,229-246`; `apps/mobile/src/components/StatusPlane.tsx:46-65`; `apps/mobile/src/components/WorkspaceRail.tsx:69-102`; `apps/mobile/src/components/PanelPrimitives.tsx:70-120`                                                                               | Define semantic text roles, minimum rendered sizes, `maxFontSizeMultiplier` policy only where justified, and alternate layouts for accessibility sizes. Preserve source, value, and unit without clipping or shrink-to-illegibility. Record AX-size screenshots and spoken order on supported widths.                                                           |
| DM-03 | P1       | The adaptive shell is a single width threshold, not the specified iPad composition. At 760 points it swaps a fixed 108-point rail for a bottom bar, but it never provides collapsible navigation, two- or three-column content, or retained map and plan context. The four-cell map strip remains horizontal at every width.                                                                      | `apps/mobile/app/index.tsx:16-20,51-58,63-69`; `apps/mobile/src/components/MapWorkspace.tsx:163-184,238-270`; `apps/mobile/src/components/PlacesWorkspace.tsx:148-177`; requirement in `docs/product/INFORMATION_ARCHITECTURE.md:18-21`                                                                         | Introduce width-class layouts based on available window space, not device identity. Specify compact, regular-one-column, regular-two-column, and map-plus-inspector compositions. Test live resize, narrow iPad windows, rotation, keyboard, pointer, and focus preservation.                                                                                   |
| DM-04 | P1       | Permission and lifecycle state machines do not exist. No code requests or observes location permission, handles `AppState`, timestamps sensor data, pauses on restoration, or distinguishes stale from current. `gpsOutage` is intentionally omitted from persisted state and resets to healthy after process death, while `simulationEnabled` persists.                                          | `apps/mobile/src/store/flight-store.ts:25-31,33-69`; repository-wide search finds no `AppState`, location request, or TaskManager usage; `apps/mobile/app.json:9-25`                                                                                                                                            | Implement an explicit source state machine covering not-requested, denied, limited, current, stale, unavailable, backgrounded, and restored-paused. Persist source/session intent safely, never a healthy implication. Request permissions in context and keep planning usable after denial. Add permission-revoke, suspend, process-death, and relaunch tests. |
| DM-05 | P1       | Native compatibility is not established. A clean iOS prebuild succeeds, but CocoaPods, full Xcode, `simctl`, compile, link, launch, and runtime checks are unavailable in this environment.                                                                                                                                                                                                       | Build record below; package boundary at `apps/mobile/package.json:20-45`; generated MapLibre post-install hook observed in disposable `ios/Podfile:61-70`                                                                                                                                                       | Run a clean frozen candidate on a pinned Xcode runner, then on supported iPhone and iPad hardware. Retain pod install, build logs, launch evidence, orientation and split-view captures, accessibility evidence, and raw MapLibre/Skia frame traces.                                                                                                            |
| DM-06 | P1       | The 48-point turbulence target is not universal. Standard actions, status, tabs, and `NEAREST` meet the declared minimum, but airport markers are only text plus small padding, have no `hitSlop`, and expose no explicit accessibility role or label. Destructive `Clear route` sits in the same wrapping action row as other route mutations with only an 8-point gap and executes immediately. | token at `packages/design-system/src/tokens.ts:32-34`; compliant controls at `apps/mobile/src/components/PanelPrimitives.tsx:90-105`; markers at `apps/mobile/src/components/MapWorkspace.tsx:124-145,219-221`; route actions at `apps/mobile/src/components/PlanWorkspace.tsx:91-95,114-120`                   | Require a 48 by 48-point interactive envelope for every cockpit target, 12-point separation around destructive neighbors, and coarse non-gesture alternatives. Add confirmation or undo for clearing a route. Test with a mounted-device/turbulence proxy protocol rather than visual inspection.                                                               |
| DM-07 | P1       | Night-mode primary controls fail contrast. Primary `Action` and `NEAREST` always use white text on the night accent `#45C0C6`, measured at 2.19:1. The same combination is used for selected Place text. This is below 3:1 even for large or bold text. High contrast and Increase Contrast are not implemented.                                                                                  | colors at `packages/design-system/src/tokens.ts:16-29`; text selection at `apps/mobile/src/components/PanelPrimitives.tsx:48-65`; `apps/mobile/src/components/MapWorkspace.tsx:173-183,247-262`; `apps/mobile/src/components/PlacesWorkspace.tsx:56-81`; theme selection only at `apps/mobile/src/theme.ts:1-7` | Use the dark panel ink already present in the theme on light-cyan controls, or darken the control fill. Verify all semantic pairs in both appearances and add an Increase Contrast response.                                                                                                                                                                    |

## Product design review

### Original identity

**What works**

- `Driftline` is a distinct working name and the interface does not reproduce another EFB's
  screen hierarchy. The workspace shell explicitly treats the map as one workspace rather than a
  universal backdrop (`docs/product/INFORMATION_ARCHITECTURE.md:3-21`).
- Teal selection, amber attention, red invalid state, and violet simulation state create a calm,
  technical palette with a useful safety vocabulary
  (`packages/design-system/src/tokens.ts:1-30`).
- The global status plane is a recognizable product-level feature and routes to evidence and
  recovery rather than generic settings (`apps/mobile/src/components/StatusPlane.tsx:13-42`).

**Gaps and assumptions**

- The documented wind-correction-arc motif is not implemented. Navigation uses generic Unicode
  symbols (`⌁`, `↗`, `⌖`, `△`, `◫`), whose rendering varies by platform and does not establish a
  proprietary icon family (`apps/mobile/src/components/WorkspaceRail.tsx:7-13`).
- `Avenir Next`, `Avenir Next Condensed`, and `Menlo` are referenced by name without bundled
  font assets or a cross-platform fallback strategy
  (`packages/design-system/src/tokens.ts:36-40`). The intended typography may not survive
  Android or licensing review.
- The name, iconography, fonts, palette, and map style still require trademark, legal,
  provenance, and operational-lighting review, as already acknowledged in
  `docs/product/DESIGN_PRINCIPLES.md:3-12,64-71`.

Recommendation: keep the restrained palette and status-plane idea, but commission a small
original symbol set based on the wind-correction arc, bundle or license a cross-platform type
family, and retain a provenance entry for each visual asset.

### Cockpit readability and progressive disclosure

The main hierarchy is easy to scan at default size: global status, stable workspace navigation,
then workspace content. Monospaced numeric values and concise labels support glance reading.
Places also uses a useful master-detail shape that can expand on wide screens.

The visual density becomes unsafe at the map edge. Navigation labels are 8 to 9 points, airport
labels are 10 points, and status metadata is 11 points. Apple lists 11 points as the recommended
iOS/iPadOS minimum for custom text, while the product is intended for glare, vibration, and
longer viewing distance. The current map strip also gives equal area to all four metrics,
without a pilot- configurable priority or an overflow treatment.

Progressive disclosure is only partly implemented. Selecting global status correctly opens
detail, but selecting a map airport replaces the entire map with Places instead of revealing a
lightweight inspector first (`apps/mobile/src/components/MapWorkspace.tsx:124-145`). Route
planning exposes all mutations together and applies them immediately; there is no draft,
calculation diff, history, or undo despite the architecture requiring those safeguards
(`docs/product/INFORMATION_ARCHITECTURE.md:46-51,59-67`).

Recommended composition:

1. Keep source state, own-ship quality, active route, and the two highest-priority navigation
   values always visible.
2. Open map selections in a bottom inspector on compact width and a persistent inspector column
   on regular width. Require a labelled action before changing the route.
3. Put secondary metrics, provenance, and calculation details behind one reachable disclosure,
   with a visible stale/error summary.
4. Make route edits a draft with undo and a before/after review before replacing active intent.

### Day, night, high contrast, and simulation

Automatic day/night selection is wired through `useColorScheme`, and the neutral palettes have
good base text contrast. Measured WCAG ratios include:

| Pair                          |   Ratio | Assessment |
| ----------------------------- | ------: | ---------- |
| Day primary on background     | 14.03:1 | Pass       |
| Day secondary on background   |  5.37:1 | Pass       |
| Night primary on background   | 16.44:1 | Pass       |
| Night secondary on background |  7.88:1 | Pass       |
| Day white on accent           |  4.85:1 | Pass       |
| Night white on accent         |  2.19:1 | Fail       |

The basemap itself does not respond to appearance. Its background, grid, route, and route shadow
are hard-coded to the night palette
(`apps/mobile/src/components/MapWorkspace.tsx:22-26,103-121`). This may be a deliberate
dark-chart direction, but it has not been specified or tested and produces a mixed day surface.
There is no high-contrast theme, `AccessibilityInfo` response, manual cockpit appearance
control, or evidence for dark adaptation and sunlight use.

Simulation treatment has the right conceptual ingredients: violet, a diamond mark, `SIMULATION`
wording, and a 3-point outer frame. DM-01 makes the implementation unsafe because all of those
cues can be removed independently of the simulated values. Simulation state should be modeled as
data provenance, not a preference.

### Loading, empty, stale, failure, and recovery states

The System workspace provides useful unavailable strings and the Plan workspace provides a route
empty state. GPS outage blanks speed and altitude and replaces own-ship with an X, which is a
good color-independent degradation start (`apps/mobile/src/components/MapWorkspace.tsx:147-171`
and `apps/mobile/src/components/OwnshipGlyph.tsx:8-19`).

The full content-state grammar is not implemented. There are no loading, partial,
permission-denied, corrupt, stale-with-age, retry, map-initialization-failure, or
storage-pressure surfaces. The global status metadata is a static string rather than source
time, fix age, accuracy, or expiry (`apps/mobile/src/components/StatusPlane.tsx:34-39`). Map
initialization has no fallback, so a native map failure can leave a blank workspace instead of
preserving text planning.

## Accessibility and turbulence review

### Current positives

- Workspace items expose the `tab` role and selected state
  (`apps/mobile/src/components/WorkspaceRail.tsx:34-61`).
- Actions, Places results, `NEAREST`, and the status plane expose button roles.
- GPS outage changes both text and shape, not only color.
- The shared `cockpitTarget` is 48 points, and the main button primitive uses it.

### Required target policy

| Element                     | Minimum interactive envelope |                Minimum separation | Notes                                                               |
| --------------------------- | ---------------------------: | --------------------------------: | ------------------------------------------------------------------- |
| Primary cockpit action      |                  56 by 56 pt |                             12 pt | Use for direct-to, source changes, and active-navigation mutations. |
| Standard action/tab/status  |                  48 by 48 pt |                              8 pt | Current shared primitive generally meets this.                      |
| Map marker/inspection point |                  48 by 48 pt |                 Collision managed | Visual glyph may be smaller; semantic and touch envelope may not.   |
| Destructive neighbor        |                  48 by 48 pt | 12 pt from non-destructive action | Add confirmation or immediate undo.                                 |
| Pointer/keyboard focus      |      Visible 3 pt equivalent |                    Not applicable | Must remain visible in day, night, and Increase Contrast.           |

These are product targets, not certification claims. The turbulence protocol must use a mounted
device or fixture, representative reach, one-handed taps, and scripted mis-tap recording.
Simulator mouse success is not evidence.

### VoiceOver and semantic gaps

- `OwnshipGlyph` supplies an `accessibilityLabel` on a plain `View` but does not explicitly mark
  the view accessible. The Skia documentation recommends accessibility properties on the Canvas
  or overlaid React Native views for internal elements. Spoken exposure must be verified, not
  assumed (`apps/mobile/src/components/OwnshipGlyph.tsx:8-19`).
- Map airport markers have `onPress` but no explicit role, state, hint, or combined airport
  label.
- The map's native compass, scale bar, gestures, marker order, and modal focus behavior have no
  recorded accessibility evidence.
- Status text includes visual separators and dense metadata but has no composed accessibility
  label that prioritizes outage, simulation, age, and remediation.
- No keyboard shortcuts, focus restoration, pointer states, Switch Control evidence, or
  non-gesture zoom controls are implemented.

### Dynamic Type acceptance

Test every workspace at the default category, the largest non-accessibility category, and all
supported accessibility categories. At each size:

- values, units, source state, warning cause, and action labels remain present;
- the map retains at least the selected critical metrics and exposes the rest through
  disclosure;
- no critical value uses shrink-to-fit below the product minimum;
- bottom navigation does not truncate or overlap the home indicator;
- rows stack before text clips, and VoiceOver order matches the visual order.

## Mobile platform review

### iPhone, iPad, split view, and orientation

The generated iOS configuration correctly targets iPhone and iPad, keeps `UIRequiresFullScreen`
false, and declares all four orientations. This is necessary for iPad multitasking but does not
prove adaptive behavior. The source uses available window width, which is the correct signal,
but only for one binary breakpoint (`apps/mobile/app/index.tsx:19-20`).

Required layout matrix:

| Window class       | Representative widths | Required composition                                                                                                              |
| ------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Compact phone      | 320, 375, 430 pt      | Bottom workspaces, compact status, map inspector sheet, navigation strip that reduces or pages without shrinking critical values. |
| Narrow iPad window | 320 to 599 pt         | Same domain behavior as compact phone; keyboard and pointer remain supported.                                                     |
| Medium window      | 600 to 759 pt         | One-column content with optional collapsible navigation; do not force five dense tabs if labels fail.                             |
| Regular iPad       | 760 to 1023 pt        | Collapsible rail plus content; Places and Plan may use two columns.                                                               |
| Wide iPad          | 1024 pt and above     | Map plus inspector or Plan plus map context where task-relevant; avoid empty stretched cards.                                     |

Run each class in portrait and landscape, then resize while a marker, search result, route edit,
text field, and System setting have focus. Verify the MapLibre camera padding and selected
object remain visible after header, rail, inspector, safe-area, keyboard, and orientation
changes.

### Permissions

`app.json` intentionally includes a clear When-In-Use explanation, but the generated Info.plist
also contains generic Always and motion strings produced by the installed plugins. No background
mode is generated. This means the current binary configuration advertises capabilities the UI
does not yet explain, while it still cannot support background navigation.

| Scenario                      | Current state                                          | Required Phase 1 behavior                                                                              |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Clean install, planning only  | No runtime request found                               | Pass only after native evidence confirms no launch prompt and all planning workflows work.             |
| Foreground position requested | Not implemented                                        | Explain benefit in context, request When In Use, show accuracy/source, support approximate and denial. |
| Permission denied/revoked     | Not implemented                                        | Keep planning and simulation available; replace live affordances with reason and Settings action.      |
| Background position           | Not configured                                         | Out of scope until TaskManager, background modes, power policy, indicator, and platform tests exist.   |
| Motion/sensors                | Plugin emits a generic purpose string; no runtime flow | Remove unused declaration or write capability-specific copy and request only at feature entry.         |

Generated purpose strings and entitlements must be reviewed from the release artifact, not only
from `app.json`. Expo's current SDK 57 documentation requires iOS `UIBackgroundModes/location`,
a top-level TaskManager task, and background permission for background location.

### Lifecycle and persistence

MMKV persistence is a useful foundation, and the selected workspace, route, selected airport,
and simulation preference are persisted. There is no hydration gate or restored-session state,
and the persisted fields are not an operationally safe session snapshot. In particular,
`gpsOutage` resets to `false` after process death. A process restart can therefore imply
restored position health without a fresh sample.

Required state transitions:

1. On background, persist user intent and route draft separately from last observed source
   sample.
2. On foreground, mark source as reacquiring until a fresh timestamped sample passes age and
   accuracy policy.
3. On process restoration, enter `RESTORED, POSITION UNCONFIRMED`; never render last values as
   live.
4. On permission revoke, source loss, native contract mismatch, or map failure, block dependent
   outputs and keep text planning available.
5. On rotation and window resize, preserve selected object, route edit, scroll/focus context,
   and camera intent.

### Android compatibility status

Android remains an architectural target, not a validated Phase 1 platform. The shared React
Native components contain no platform-specific layout branches, which is a useful baseline, but
equal source does not establish equal behavior:

- `app.json` declares coarse and fine foreground location permissions, but there is no
  in-context runtime request, approximate-location treatment, denial recovery, background
  permission, foreground service, or notification policy (`apps/mobile/app.json:17-25`).
- The type system names Apple fonts directly. Android rendering and metric fallback can change
  wrapping, hierarchy, and touch geometry even when TypeScript output is identical
  (`packages/design-system/src/tokens.ts:36-40`).
- MapLibre React Native v11 uses `GLSurfaceView` by default on Android. The map plus React
  Native overlay, modal/sheet stacking, snapshot behavior, and accessibility order need explicit
  Android validation; switching to `TextureView` is a measured tradeoff, not a speculative fix.
- TalkBack, system font scaling, hardware Back, keyboard, pointer, window resizing, process
  death, low-memory recreation, foreground service behavior, and Android native compilation are
  all `NOT RUN`.

Do not describe Android as supported from package compatibility alone. Publish an explicit
compatibility status until a representative API/device matrix has native build, launch,
accessibility, lifecycle, and MapLibre evidence.

### MapLibre, Skia, and native assumptions

**Supported by current evidence**

- `@maplibre/maplibre-react-native` 11.3.6 is paired with React Native 0.86 and Expo 57. Current
  MapLibre documentation says v11 requires the New Architecture and React Native 0.80 or newer.
- The app uses the v11 `Map` API and prebuild emits the MapLibre CocoaPods post-install hook.
- Skia 2.6.2 supports React Native 0.79 or newer and React 19 according to current Skia
  documentation; the app uses RN 0.86 and React 19.2.3.
- Rendering ownership matches the ADR: MapLibre renders geographic layers; Skia renders only a
  bounded 48-point own-ship glyph; React Native renders text and controls.

**Unproven or risky**

- `preferredFramesPerSecond={60}` is a request, not a measured frame budget
  (`apps/mobile/src/components/MapWorkspace.tsx:91-100`). No simulator or physical traces exist.
- Every airport is a React Native `Marker` view. That is acceptable for three fixtures but
  cannot be assumed to scale to production density. Production airports and labels should
  default to MapLibre sources and symbol layers with measured selection affordances.
- The fixed offline style does not have day/night variants, error callbacks, attribution UI,
  tile package handling, or a loading/unavailable fallback.
- MapLibre native gestures and React Native overlay controls have not been tested together under
  VoiceOver, split resizing, safe-area changes, or high-rate own-ship updates.
- The Skia glyph's semantic wrapper has not been verified in the native accessibility tree.
- CocoaPods integration, MapLibre/Skia native compilation, Metal runtime, and MMKV startup
  remain unbuilt in this environment.

## Native build record

### Environment

- Candidate: clean Git export of `e96a2e2` in `/tmp/efb-ios-e96a2e2.Akzq45`
- Node: `v22.21.1`
- pnpm: `11.9.0`
- macOS: `27.0` build `26A5378j`
- Active developer directory: `/Library/Developer/CommandLineTools`
- Xcode: unavailable
- CocoaPods: unavailable
- Available iOS simulators: unavailable because `simctl` is absent

### Attempts and outcomes

| Step                          | Command                                                                                                                                 | Result                     | Evidence                                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen install                | `pnpm install --frozen-lockfile`                                                                                                        | PASS                       | 721 packages linked from the lockfile; completed in 4.2 seconds.                                                                                               |
| Clean iOS prebuild            | Expo CLI `prebuild --platform ios --clean --no-install` against the disposable clean export                                             | PASS                       | Generated `ios/Driftline.xcodeproj`, `Info.plist`, Podfile, Swift app delegate, assets, and Expo support files without changing committed source.              |
| CocoaPods availability        | `pod --version`                                                                                                                         | BLOCKED                    | `zsh: command not found: pod`                                                                                                                                  |
| Xcode availability            | `xcodebuild -version`                                                                                                                   | BLOCKED                    | `xcode-select: error: tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools' is a command line tools instance` |
| Simulator inventory           | `xcrun simctl list devices available`                                                                                                   | BLOCKED                    | `xcrun: error: unable to find utility "simctl", not a developer tool or in PATH`                                                                               |
| Simulator-target native build | `xcodebuild -project ios/Driftline.xcodeproj -scheme Driftline -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build` | BLOCKED before compilation | Same Xcode Command Line Tools error. No compile, link, install, or launch occurred.                                                                            |

Generated configuration inspection found:

- deployment target `16.4` and device family `1,2` in the generated project;
- full iPhone/iPad orientation declarations and `UIRequiresFullScreen=false`;
- Hermes enabled;
- MapLibre post-install integration emitted;
- generic `NSLocationAlwaysAndWhenInUseUsageDescription`, deprecated
  `NSLocationAlwaysUsageDescription`, and `NSMotionUsageDescription` strings;
- no `UIBackgroundModes/location` entry.

These generated files were inspected only in the disposable export and are not part of this
branch. Prebuild success proves configuration generation only. It does not prove CocoaPods
resolution, native compilation, simulator launch, physical-device behavior, or release
suitability.

## Acceptance plan and next action

### Immediate implementation order

1. Fix DM-01 before adding live location. Make simulated provenance inseparable from the
   rendered values and remove the user-facing off switch until a real source transition exists.
2. Add the permission/source/lifecycle state machine and a map unavailable fallback. Treat
   restored position as unconfirmed until a fresh sample arrives.
3. Define semantic typography and four width-class compositions. Resolve night action contrast,
   map marker target size, destructive-action separation, and original icon/font assets.
4. Add accessibility labels and actions for MapLibre/Skia content, non-gesture alternatives, and
   explicit high-contrast behavior.
5. Produce a frozen native candidate on a machine with full Xcode and CocoaPods. Complete
   simulator functional checks, then separately record physical iPhone/iPad checks for sunlight,
   night, turbulence proxy, frame pacing, battery, lifecycle, and background behavior.

### Exit evidence

Phase 1 design/mobile approval requires all of the following, with no inference from screenshots
or source alone:

- automated tests proving simulated values cannot render without persistent simulated identity;
- default and accessibility Dynamic Type captures and VoiceOver transcripts for every workspace;
- target-size audit plus mounted-device/turbulence-proxy mis-tap results;
- iPhone and iPad layout evidence at the width and orientation matrix above;
- permission denial/revoke, suspend/resume, rotation, split resize, process-death, and
  restoration evidence;
- clean pod install, native compile, simulator launch, and runtime smoke evidence;
- separate physical-device MapLibre/Skia frame, thermal, battery, and long-session traces;
- pilot/human-factors review of glance readability and real-versus-simulated recognition.

## Sources

Repository evidence:

- `docs/product/PRODUCT_REQUIREMENTS.md:71-94`
- `docs/product/DESIGN_PRINCIPLES.md:3-62`
- `docs/product/INFORMATION_ARCHITECTURE.md:3-67`
- `docs/testing/PHASE_GATE_CHECKLIST.md:59-79`
- `docs/testing/RELEASE_EVIDENCE.md:50-96`
- `docs/architecture/adr/0002-expo-new-architecture-map-and-native-boundary.md:13-102`

Primary external references, refreshed 2026-07-14:

- [Apple Human Interface Guidelines: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility/)
- [Apple Human Interface Guidelines: Multitasking](https://developer.apple.com/design/human-interface-guidelines/multitasking)
- [Apple UIKit: View layout](https://developer.apple.com/documentation/uikit/view-layout)
- [Expo SDK 57: Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/)
- [MapLibre React Native: Getting started](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/)
- [MapLibre React Native: Migrating to v11](https://maplibre.org/maplibre-react-native/docs/setup/migrations/v11/)
- [React Native Skia: Installation](https://shopify.github.io/react-native-skia/docs/getting-started/installation/)
- [React Native Skia: Canvas accessibility](https://shopify.github.io/react-native-skia/docs/canvas/overview/)
