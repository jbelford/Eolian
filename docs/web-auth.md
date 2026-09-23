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
- `SESSION_SECRET`: private application secret used to authenticate OAuth state and derive stored
  session keys. Its UTF-8 encoding must contain at least 32 bytes.
- `BASE_URI`: public application origin. The registered Discord redirect URI must be
  `<BASE_URI origin>/api/auth/discord/callback`.

Use a high-entropy, randomly generated `SESSION_SECRET` that satisfies the 32-byte minimum and
store all secrets outside the repository. Production must serve `BASE_URI` over HTTPS so the
session cookie can use the `Secure` attribute.

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
fetches manageable-guild claims with the sealed access token on every authenticated request; the
full guild list is not stored in the cookie, so large lists do not exceed browser limits. Discord
lookup failures return a sanitized retryable error. The protected settings API additionally checks
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
