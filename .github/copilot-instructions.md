# Copilot instructions for Eolian

## Toolchain and validation

- Use the repository-pinned Node.js 24.21.0 and Yarn 4.4.1 toolchain. Run `mise trust`,
  `mise install --locked node`, and `mise run setup` for initial setup; the setup task installs
  the immutable Yarn dependency tree and checksum-pinned yt-dlp executable.
- `yarn typecheck` checks the Node application, browser application, test suites, and E2E harness.
- `yarn build` typechecks and builds both Vite targets. `yarn build-dev` produces development
  builds with source maps, and `yarn build-web` checks and builds only the browser target.
- `mise run lint` is the repository lint command; it runs `yarn format:check`. Use `yarn format`
  to apply Prettier formatting.
- `yarn test` or `yarn test:unit` runs the unit suite. `yarn test:coverage` also enforces the
  coverage thresholds configured in `vitest.shared.mts`.
- Run one unit test file with
  `yarn test:unit tests/unit/resolvers/factory.test.ts`, or one named test with
  `yarn test:unit tests/unit/resolvers/factory.test.ts -t "routes playlists"`.
- `yarn test:integration` runs the serialized integration suite, including the real
  `ffmpeg-static` audio pipeline. Run one integration file with
  `yarn vitest run --config vitest.integration.config.mts tests/integration/framework/voice/song-stream.ffmpeg.test.ts`.
- `yarn e2e` runs the separate Discord playback harness and requires the configuration described
  in `docs/e2e-discord-harness.md`; it is not part of the normal local unit-test loop.

## Architecture

- `src/app.ts` is the Node bootstrap. It creates OAuth providers, MongoDB access, the command
  parser, `DiscordEolianBot`, and the Express `WebServer`, then registers all closable resources
  for process-exit cleanup.
- The project has two Vite outputs. `vite.node.config.mts` builds the CommonJS bot/server entry as
  `dist/bundle.js` while leaving runtime dependencies external. `vite.web.config.mts` builds the
  React frontend from `index.html` and `web/index.tsx` into `dist/public`.
- `src/framework` isolates Discord.js behind context interfaces so command implementations work
  for legacy messages, slash commands, context-menu commands, and buttons without depending on
  raw Discord interaction types. `DiscordEolianBot` owns event routing, permission checks,
  per-user command locking, and guild-state lookup.
- Commands receive a normalized `CommandOptions` object regardless of syntax. Keyword,
  traditional flag, and slash-command inputs all pass through the command-option parsing layer
  before the same command `execute(context, options)` method is called.
- Track loading is a two-stage pipeline. `getSourceResolver` selects a provider/resource resolver
  from URLs, keywords, feature flags, and guild YouTube availability; the resulting identifier is
  then passed to `getSourceFetcher` to produce tracks. Spotify tracks may ultimately be resolved
  to playable YouTube streams.
- `DiscordGuildStore` lazily creates one `DiscordGuildState` per active guild. That state owns the
  guild queue, player, and displays; idle portions are closed on cache expiry while active state
  is retained. Queue storage uses a longer shared in-memory TTL than guild state.
- Playback flows from a queued `Track` through its source stream, `SongStream`/FFmpeg filters,
  volume transformation and Opus encoding, then the Discord voice connection. The player
  advances the queue when Discord reports the audio resource idle.
- YouTube playback uses the checksum-pinned yt-dlp executable installed by `mise run setup` and
  streams its standard output into the existing `SongStream` pipeline.
- The data layer combines MongoDB-backed users/servers with in-memory TTL caches. OAuth callbacks
  and the optional static website are served by the same Express process as `/healthz`.

## Repository conventions

- Import application modules through the `@eolian/*` alias rooted at `src`. Modules commonly
  expose public APIs through `index.ts` barrels and keep shared interfaces/types in `@types.ts`.
- Keep command code on the framework context abstractions (`CommandContext`, `ContextUser`,
  `ContextCommandInteraction`, and related types); do not couple commands directly to Discord.js
  objects.
- When changing commands or option parsing, preserve equivalent behavior across keyword,
  traditional, and slash syntaxes. Pattern priority is behaviorally significant because higher
  priority patterns parse first.
- Throw `EolianUserError` for failures that should be shown to a user. Unexpected failures follow
  the framework's generic-error path and should be logged rather than converted into
  success-shaped responses.
- Long-lived resources implement `Closable.close()`. New top-level resources created by the
  application bootstrap must participate in `cleanupOnExit`; state components must release
  timers, caches, streams, connections, and registered buttons when closed.
- Tests live under `tests/unit` and `tests/integration` and use the `@eolian/*` alias. Unit tests
  mock Discord, HTTP/SDK, OAuth, and database boundaries; do not require live credentials,
  network services, Discord, or MongoDB. Integration tests are reserved for real local
  dependencies such as FFmpeg and run serially.
- Test setup supplies required environment variables and restores mocks, globals, and environment
  stubs after each test. Prefer explicit behavioral assertions over broad snapshots.
- Prettier is authoritative: 100-character width, single quotes, and omitted parentheses for
  single arrow-function parameters. TypeScript is strict and checks unused locals and complete
  returns.
- Environment configuration is centralized in `src/common/env.ts`. Required values terminate
  startup when absent; optional provider configurations are enabled only when all required fields
  for that provider are present. Never commit `.env` credentials.
- Update only documentation directly relevant to the code or behavior being changed. Keep durable
  design, development, testing, and operational guidance in `docs/`; do not add task reports,
  implementation-session notes, or unrelated context.
- Treat `README.md` as public-facing project documentation. Keep it focused on what Eolian is,
  its user-visible features, and links to deeper documentation; do not put developer workflows or
  internal implementation details there.
