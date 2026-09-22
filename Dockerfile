# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24.21.0-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6

FROM ${NODE_IMAGE} AS dependencies

WORKDIR /usr/src/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases/ .yarn/releases/
COPY scripts/install-ytdlp.sh scripts/install-ytdlp.sh

RUN corepack enable \
    && yarn install --immutable

FROM dependencies AS build

ARG COMMIT_DATE

COPY src/ src/
COPY tsconfig.json ./
COPY vite.node.config.mts ./

RUN test -n "$COMMIT_DATE" \
    && COMMIT_DATE="$COMMIT_DATE" yarn build:node

FROM dependencies AS production-dependencies

RUN yarn workspaces focus --all --production

FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY scripts/install-ytdlp.sh /usr/local/bin/install-ytdlp

# Keep Azure App Service's SSH contract while installing only the runtime support needed by
# production modules and the pinned yt-dlp executable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        dialog \
        libstdc++6 \
        openssh-server \
        python3 \
    && /usr/local/bin/install-ytdlp /usr/local \
    && rm /usr/local/bin/install-ytdlp \
    && echo "root:Docker!" | chpasswd \
    && mkdir -p /run/sshd \
    && rm -rf /var/lib/apt/lists/*

COPY --from=production-dependencies /usr/src/app/node_modules/ node_modules/
COPY --from=build /usr/src/app/dist/bundle.js dist/bundle.js
COPY package.json ./
COPY docker/sshd_config /etc/ssh/sshd_config
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod 0755 /usr/local/bin/entrypoint.sh

EXPOSE 8000 2222 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]