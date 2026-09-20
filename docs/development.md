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

## Validation

```bash
mise run lint
mise run build
```
