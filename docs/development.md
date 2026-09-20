# Development setup

Development uses [mise](https://mise.jdx.dev/) to install the repository's pinned Node.js
and Yarn versions and to expose the common setup, lint, and build tasks.

## Prerequisites

Install these non-secret prerequisites before onboarding:

- Git and mise
- Network access for tool and package downloads
- Python 3, `make`, and a C/C++ compiler when a native Node.js dependency needs to build
  from source
- Docker only when building the container image

mise manages Node.js 20.19.6 and enables Corepack for this repository. Corepack selects
the checksum-pinned Yarn 4.4.1 release declared in `package.json`. mise does not install
Docker or operating-system build dependencies.

## Onboarding

```bash
git clone https://github.com/jbelford/Eolian.git
cd Eolian
mise trust
mise install --locked node
mise run setup
```

The application requires service credentials at runtime, but they are not needed to lint
or build the project. Keep credentials in a local `.env` file and do not commit them.

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
yarn start       # Start the built bot and web server using environment variables from .env
yarn start-debug # Start the built application with the Node inspector
```

## Validation

```bash
mise run lint
mise run build
```
