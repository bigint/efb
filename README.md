# Driftline

An original, safety-conscious electronic flight bag platform for flight simulation, pilot
education, pre-flight planning, and non-certified situational awareness.

> Driftline is under active development. It is not approved as a primary navigation instrument
> and currently contains only fictional demonstration aviation data.

## Current vertical slice

- Expo SDK 57 / React Native 0.86 development-build application for iPhone, iPad, and Android
- New Architecture-only native stack with Expo Router, MapLibre Native, Skia, Zustand, TanStack
  Query, MMKV, SQLite, and Zod
- Offline native demonstration map with a graticule, fictional airports, route line, Skia
  own-ship glyph, navigation strip, and explicit GPS failure injection
- Adaptive iPad rail and compact iPhone navigation
- Ephemeral route editing plus durable revisioned flight drafts, local airport search/details,
  user-entered aircraft profiles, an explicitly fictional weight-and-balance sandbox, and
  data/source status
- Framework-independent typed units, provenance contracts, great-circle calculations,
  cross-/along-track calculations, true-reference wind-triangle solving, and route summaries
  with deterministic and property-based tests
- Conservative METAR/SPECI parsing plus bounded on-demand AWC raw METAR and TAF retrieval. Raw
  text, source/retrieval time, uncertainty, and unsupported groups remain visible; the result is
  explicitly supplemental and not a complete briefing
- App-private PDF import with post-copy SHA-256 verification and non-destructive storage audit,
  verified copy sharing, immutable checklist completion/abandonment history, and a bounded
  offline logbook dashboard with neutralized CSV export
- Bounded GPX route snapshots, explicit weather-cache deletion, session-only range rings and
  breadcrumb trail, and fail-closed relational SQLite snapshot reads

## Run

```sh
pnpm install
pnpm verify
pnpm --dir apps/mobile doctor
pnpm --filter @driftline/mobile start
```

MapLibre, Skia, and MMKV require an Expo development build rather than Expo Go. Generate and run
the native project with `pnpm --filter @driftline/mobile ios` or `android` after the platform
toolchain is installed.

Architecture, licensing research, operational limitations, security, and verification gates live
in [`docs/`](docs/). The current evidence and explicit native/device blockers are maintained in
[`docs/status/PROJECT_STATUS.md`](docs/status/PROJECT_STATUS.md).
