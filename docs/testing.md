# Testing Eolian

Eolian uses Vitest for automated tests. Production bundles continue to use Webpack; Vite is used
only through the Vitest test runner.

## Setup

Complete the repository's [development setup](development.md), then install the locked
dependency tree:

```bash
mise run setup
```

## Commands

```bash
yarn test              # Run unit tests once
yarn test:watch        # Rerun affected unit tests while developing
yarn test:coverage     # Run unit tests and enforce coverage thresholds
yarn test:integration  # Run real integration tests, including FFmpeg
yarn typecheck         # Typecheck production and test TypeScript
yarn build             # Build the production Webpack bundle
```

## Suite organization

Unit tests live under `tests/unit` and mirror the source areas they exercise. They test commands,
resolvers, framework code, API clients, data structures, and other application behavior without
requiring Discord, network services, MongoDB, or credentials.

Integration tests live under `tests/integration`. They are reserved for behavior that benefits from
using a real local dependency rather than a mock.

## Test boundaries

Tests should exercise Eolian's observable behavior while mocking external boundaries:

- Mock Discord objects and verify the framework adapters' behavior.
- Mock HTTP, SDK, OAuth, and database clients without recreating their internal implementations.
- Use fake timers only in tests that control time, and restore them after each test.
- Prefer explicit structural assertions over broad snapshots.
- Avoid live network requests, credentials, and shared external state.

Production dependencies may be injected when deterministic control is needed, but their default
implementations must preserve the normal runtime path.

## Parallel execution

Unit test files run in isolated fork workers with file-level parallelism. The worker limit is
expressed as a percentage so it adapts to the available logical CPUs instead of assuming a
particular machine size. In-file asynchronous concurrency is capped to avoid overwhelming shared
resources.

Integration tests use a separate Vitest configuration with one worker and no file-level
parallelism. This keeps process-heavy tests predictable and prevents them from competing with the
unit suite.

## FFmpeg integration

The audio integration suite generates a short WAV input in memory and processes it through the real
`SongStream` and `ffmpeg-static` pipeline. It verifies the PCM output format and an audio filter
without using checked-in media or network streams.

The suite is skipped with a reason when `ffmpeg-static` does not provide an executable for the
current platform or lacks a required filter. Supported Linux environments run it as part of CI.

## Coverage

V8 coverage is enforced globally at:

- 85% statements
- 78% branches
- 85% functions
- 85% lines

Coverage includes production TypeScript. Exclusions are limited to the executable application
bootstrap, type-only files, barrel exports, and the browser-backed YouTube proof-token integration.
New exclusions should represent genuine external or generated boundaries rather than untested
application behavior.
