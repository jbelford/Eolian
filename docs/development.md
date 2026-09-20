# Developing Eolian

Eolian requires Node.js 20.19.6 or newer and uses Yarn through Corepack.

## Setup

```bash
corepack enable
yarn install --immutable
```

## Build architecture

The application has two Vite targets:

- `vite.node.config.mts` creates the CommonJS bot/server entry at `dist/bundle.js`. Application
  modules are bundled, while runtime packages and Node built-ins remain external so native
  dependencies load from `node_modules`.
- `vite.web.config.mts` processes `index.html` and the React entry into `dist/public`. The Express
  server serves this directory when the website feature flag is enabled.

The Node build injects `__COMMIT_DATE__` from the latest Git commit. It also maps the
`@eolian/*` import alias to `src/*`, matching the TypeScript configuration.

## Commands

```bash
yarn build       # Typecheck and build the production Node and browser applications
yarn build-dev   # Build both targets with source maps and without minification
yarn build-web   # Typecheck and build only the browser application
yarn typecheck   # Check production, browser, and test TypeScript without emitting files
yarn start       # Start the built bot and web server using environment variables from .env
yarn start-debug # Start the built application with the Node inspector
```

The production and development builds use the same output paths, so PM2, Docker, and local
startup commands all execute `dist/bundle.js`.
