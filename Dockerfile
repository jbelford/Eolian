# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:20.19.6-bookworm-slim@sha256:b342de02eb4a57cd6986290a69833d20818508db8078dba0197a024193410aee

FROM ${NODE_IMAGE} AS dependencies

WORKDIR /usr/src/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases/ .yarn/releases/

RUN corepack enable \
    && yarn install --immutable

FROM dependencies AS build

ARG COMMIT_DATE

COPY index.html ./
COPY src/ src/
COPY tests/ tests/
COPY web/ web/
COPY tsconfig.json tsconfig.test.json ./
COPY vite.node.config.mts vite.web.config.mts vitest.config.mts vitest.integration.config.mts vitest.shared.mts ./

RUN test -n "$COMMIT_DATE" \
    && COMMIT_DATE="$COMMIT_DATE" yarn build

FROM dependencies AS production-dependencies

RUN yarn workspaces focus --all --production

FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Keep Azure App Service's SSH contract while limiting the runtime packages to
# certificates, SSH, and native-library support required by production modules.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        dialog \
        libstdc++6 \
        openssh-server \
    && echo "root:Docker!" | chpasswd \
    && mkdir -p /run/sshd \
    && rm -rf /var/lib/apt/lists/*

COPY --from=production-dependencies /usr/src/app/node_modules/ node_modules/
COPY --from=build /usr/src/app/dist/ dist/
COPY package.json ./
COPY docker/sshd_config /etc/ssh/sshd_config
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod 0755 /usr/local/bin/entrypoint.sh

EXPOSE 8000 2222 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]