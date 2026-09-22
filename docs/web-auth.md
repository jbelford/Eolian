# Web authentication

The Fastify API authenticates browser users with Discord's OAuth 2 authorization-code flow. The
server requests only the `identify` and `guilds` scopes. Discord access tokens are sealed inside
an authenticated, encrypted HttpOnly cookie using `@fastify/secure-session`; refresh tokens are
not retained for web sessions. Neither token is included in browser API responses.

## Configuration

The Node application requires these web-auth values in addition to the existing bot and database
configuration:

- `DISCORD_CLIENT_ID`: Discord application client ID.
- `DISCORD_CLIENT_SECRET`: Discord application client secret.
- `SESSION_SECRET`: private application secret used to authenticate OAuth state and derive the
  secure-session encryption key. Its UTF-8 encoding must contain at least 32 bytes.
- `BASE_URI`: public application origin. The registered Discord redirect URI must be
  `<BASE_URI origin>/api/auth/discord/callback`.

Use a high-entropy, randomly generated `SESSION_SECRET` that satisfies the 32-byte minimum and
store all secrets outside the repository. Production must serve `BASE_URI` over HTTPS so the
session cookie can use the `Secure` attribute.

## Local browser login

Run the local bot API on port 8080 and the Vite SPA on `http://localhost:5173`. Vite proxies
`/api/*` and `/callback/*` to the bot without rewriting paths; OAuth and settings requests must
use the browser's origin rather than opening the API server directly. Set
`BASE_URI=http://localhost:5173` in the bot's local profile. Register
`http://localhost:5173/api/auth/discord/callback` with the local Discord application, and, when
enabled, `http://localhost:5173/callback/spotify` and
`http://localhost:5173/callback/soundcloud` with their respective providers. The development
server holds port 5173 to avoid silently changing the OAuth origin.
The Vite proxy is development-only; production hosting must route `/api/*` and `/callback/*` to
the Node server on the browser's public origin.

## API contract

All routes are under `/api/auth`:

| Method | Route                     | Behavior                                                                                                       |
| ------ | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/discord?returnTo=/path` | Starts Discord login and accepts only a same-origin absolute path as `returnTo`.                               |
| `GET`  | `/discord/callback`       | Validates the signed, short-lived OAuth state, exchanges the code, and creates a new session.                  |
| `GET`  | `/session`                | Returns `{ "authenticated": false }` or the sanitized user, manageable guilds, CSRF token, and session expiry. |
| `POST` | `/logout`                 | Requires the session cookie, same-origin `Origin`, and `x-csrf-token`; clears the browser cookie.              |

Successful login sets `eolian_session` to a libsodium-encrypted secure-session cookie containing
the Discord access token, identity, and CSRF token. The cookie is `HttpOnly`, `SameSite=Lax`,
`Path=/`, and `Secure` in production. Its serialized header must fit within 4096 bytes; a token
that would exceed the limit is rejected, never truncated. The plugin's **default validity
(approximately 24 hours)** is checked in its encrypted payload, independent of the browser
cookie's matching maximum age. A Discord access token must remain valid throughout that period
or login fails. Expiry is absolute from login: reads never touch or reissue the session cookie.

The browser receives only a sanitized user, manageable guilds, CSRF token, and expiry. The server
fetches manageable-guild claims with the sealed access token on every authenticated request, not
during the OAuth callback. The full guild list is not stored in the cookie, so large lists do not
exceed browser limits. Guild lookup failures return a sanitized retryable error. The protected
settings API additionally checks
live bot membership and permissions for each guild request. There is no MongoDB session collection
or TTL index; other bot/account data remains in MongoDB.

Logout validates the cookie, origin, and CSRF without contacting Discord, then clears the browser
cookie only. A copied cookie remains usable until the embedded expiry (or until Discord
invalidates the access token). Reauthorization issues a new cookie; it does not revoke older copies.

## Protected API routes

Future mutating routes should share one `AuthSecurity` instance created by `createAuthSecurity`.
Apply its hooks in this order:

```ts
preHandler: [security.guards.authenticate, security.guards.origin, security.guards.csrf];
```

The authenticated record is then available as `request.authSession`. API DTOs must select safe
fields explicitly and must not return the stored access token, refresh token, session key, or raw
Discord SDK objects.

## Browser integration

The React application bootstraps its in-memory auth state from `GET /api/auth/session`. Browser API
requests use same-origin credentials, and the CSRF token is held only in that auth state for
authenticated mutations such as logout. The token is never written to browser storage.

Protected routes preserve the requested same-origin path while sending unauthenticated users
through `/api/auth/discord`. The authenticated shell exposes nested account and guild route outlets;
guild children receive the selected manageable guild as router outlet context.

## Settings API

Settings routes use the same session service and opaque cookie. Every guild request resolves the
current session before checking the refreshed Discord guild claims. Guild access requires the
Discord user to own the guild or have `Administrator` or `Manage Guild`, and the bot must still be
present in its ready-client cache.

Mutation hooks always run in this order:

```ts
preHandler: [security.guards.authenticate, security.guards.origin, security.guards.csrf];
```

All request objects are strict: unknown properties are rejected. Errors use
`{ "error": { "code": string, "message": string } }`.

### Personal settings

| Method   | Route                                   | Response or behavior                                                                                    |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/account`                          | Returns the syntax override and boolean-only Spotify/SoundCloud link status.                            |
| `PATCH`  | `/api/account/syntax`                   | Accepts `{ "syntax": "keyword" \| "traditional" \| null }`; `null` restores the guild/default behavior. |
| `POST`   | `/api/account/providers/:provider/link` | Returns `{ "authorizationUrl": string }` for an enabled existing OAuth provider flow.                   |
| `DELETE` | `/api/account/providers/:provider`      | Removes cached authorization state, refresh tokens, and legacy provider identifiers.                    |

`GET /api/account` returns:

```json
{
  "syntax": null,
  "providers": {
    "spotify": { "linked": false, "linkAvailable": true },
    "soundcloud": { "linked": true, "linkAvailable": true }
  }
}
```

Provider identifiers and refresh tokens are never returned. Provider authorization is suitable
for a browser popup: open the returned URL and let the existing `/callback/spotify` or
`/callback/soundcloud` page complete the flow.

### Guild settings

| Method  | Route                  | Response or behavior                                                                         |
| ------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `GET`   | `/api/guilds`          | Lists only manageable Discord guilds that are also in the bot's current cache.               |
| `GET`   | `/api/guilds/:guildId` | Returns guild metadata, effective settings, configurable text channels, and available roles. |
| `PATCH` | `/api/guilds/:guildId` | Applies one or more guild setting fields and returns the refreshed guild DTO.                |

The guild detail DTO is:

```json
{
  "id": "123",
  "name": "Example",
  "icon": null,
  "memberCount": 42,
  "settings": {
    "prefix": "!",
    "volume": 0.1,
    "syntax": "keyword",
    "preferredChannelId": null,
    "djRoleIds": [],
    "djAllowLimited": false
  },
  "channels": [{ "id": "456", "name": "music" }],
  "roles": [{ "id": "789", "name": "DJ" }]
}
```

`PATCH` accepts any non-empty subset of the `settings` fields. Prefixes are exactly one character,
volume is between `0` and `1`, syntax is `keyword` or `traditional`, the preferred channel must be
a listed text or announcement channel (or `null` to clear it), and DJ roles must be unique,
belong to the guild, exclude `@everyone`, and contain at most ten IDs. Writes update the bot's
active guild configuration immediately; an idle active player also receives a changed default
volume.

Stable settings error codes include `invalid_request`, `guild_forbidden`, `bot_not_ready`,
`bot_not_in_guild`, `channel_not_found`, `role_not_found`, `provider_link_unavailable`,
`provider_link_failed`, `persistence_failed`, `guild_load_failed`, `guild_list_failed`, and
`settings_update_failed`.
