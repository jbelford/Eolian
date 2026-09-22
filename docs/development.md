# Development setup

Development uses [mise](https://mise.jdx.dev/) to install the repository's pinned Node.js
and Yarn versions and to expose the common setup, lint, and build tasks.

## Prerequisites

Install these non-secret prerequisites before onboarding:

- Git and mise
- Network access for tool and package downloads
- Python 3 and curl for the pinned yt-dlp executable
- `make` and a C/C++ compiler when a native Node.js dependency needs to build from source
- Docker only when building the container image

mise manages Node.js 24.21.0 and enables Corepack for this repository. Corepack selects the
checksum-pinned Yarn 4.4.1 release declared in `package.json`. The setup task also installs a
checksum-pinned yt-dlp release under `.tools/`. mise does not install Docker or operating-system
build dependencies.

## Onboarding

```bash
git clone https://github.com/jbelford/Eolian.git
cd Eolian
mise trust
mise install --locked node
mise run setup
```

The application requires service credentials at runtime, but they are not needed to lint
or build the project. Store the shared local runtime configuration outside the Git checkout:

```bash
mkdir -p ~/.config/eolian/profiles
chmod 700 ~/.config/eolian ~/.config/eolian/profiles
$EDITOR ~/.config/eolian/profiles/default.env
chmod 600 ~/.config/eolian/profiles/default.env
```

All worktrees use this file through mise, so credentials do not need to be copied or linked into
each checkout. Do not commit environment files or credentials.

## Build architecture

The application has two Vite targets:

- `vite.node.config.mts` creates the CommonJS bot/server entry at `dist/bundle.js`. Application
  modules are bundled, while runtime packages and Node built-ins remain external so native
  dependencies load from `node_modules`.
- `vite.web.config.mts` processes `index.html` and `web/index.tsx` into `dist/public`. The Express
  server serves this directory when the website feature flag is enabled.

The Node build injects `__COMMIT_DATE__` from the latest Git commit. It also maps the
`@eolian/*` import alias to `src/*`, matching the TypeScript configuration. Production and
development builds use the same output paths, so PM2, Docker, and local startup commands all
execute `dist/bundle.js`.

## Commands

```bash
yarn build       # Typecheck and build the production Node and browser applications
yarn build-dev   # Build both targets with source maps and without minification
yarn build-web   # Typecheck and build only the browser application
yarn typecheck   # Check production, browser, and test TypeScript without emitting files
mise run start-local # Start the built bot and web server with the shared local environment
mise run start-debug # Start the built application with the Node inspector
```

The start tasks direct the application's dotenv loader to
`~/.config/eolian/profiles/default.env`. Build, lint, and setup tasks do not receive runtime
credentials.

## YouTube streaming

`mise run setup` installs a checksum-pinned yt-dlp release under `.tools/`. Local start tasks set
`YTDLP_PATH` to that executable. The production container installs the same release under
`/usr/local/bin`.

Eolian streams the best available YouTube audio format from yt-dlp's standard output. yt-dlp uses
Node.js 24 for YouTube's JavaScript challenges. The optional settings are:

- `YTDLP_PATH` overrides the yt-dlp executable.
- `YTDLP_COOKIES_PATH` supplies a Netscape-format cookie file for restricted content.

Do not use account cookies unless required. YouTube may restrict or ban accounts that automate
requests, and cookies should be stored outside the repository with the same protections as other
credentials.

## Validation

```bash
mise run lint
mise run build
```
