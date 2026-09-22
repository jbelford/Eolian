# Web authentication

The Fastify API authenticates browser users with Discord's OAuth 2 authorization-code flow. The
server requests only the `identify` and `guilds` scopes. Discord access and refresh tokens remain
server-side and are never included in browser responses.

## Configuration

The Node application requires these web-auth values in addition to the existing bot and database
configuration:

- `DISCORD_CLIENT_ID`: Discord application client ID.
- `DISCORD_CLIENT_SECRET`: Discord application client secret.
- `SESSION_SECRET`: private application secret used to authenticate OAuth state and derive stored
  session keys.
- `BASE_URI`: public application origin. The registered Discord redirect URI must be
  `<BASE_URI origin>/api/auth/discord/callback`.

Use a high-entropy `SESSION_SECRET` and store all secrets outside the repository. Production must
serve `BASE_URI` over HTTPS so the session cookie can use the `Secure` attribute.

## API contract

All routes are under `/api/auth`:

| Method | Route                     | Behavior                                                                                                           |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/discord?returnTo=/path` | Starts Discord login and accepts only a same-origin absolute path as `returnTo`.                                   |
| `GET`  | `/discord/callback`       | Validates the signed, short-lived OAuth state, exchanges the code, and creates a new session.                      |
| `GET`  | `/session`                | Returns `{ "authenticated": false }` or the sanitized user, manageable guilds, CSRF token, and session expiry.     |
| `POST` | `/logout`                 | Requires the session cookie, same-origin `Origin`, and `x-csrf-token`; deletes the session and expires the cookie. |

Successful login sets an opaque random session ID in the `eolian_session` cookie. The cookie is
`HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production. Sessions roll for seven days,
with persistence writes bounded to at most one renewal per day.

MongoDB stores a keyed digest of the session ID, the required Discord identity fields, Discord
token refresh metadata, manageable-guild claims, the CSRF token, and timestamps. The `sessions`
collection has an absolute-expiry TTL index on `expiresAt`; expired and logged-out records are
also removed explicitly when encountered.

## Protected API routes

Future mutating routes should share one `AuthSecurity` instance created by `createAuthSecurity`.
Apply its hooks in this order:

```ts
preHandler: [security.guards.authenticate, security.guards.origin, security.guards.csrf];
```

The authenticated record is then available as `request.authSession`. API DTOs must select safe
fields explicitly and must not return the stored access token, refresh token, session key, or raw
Discord SDK objects.
