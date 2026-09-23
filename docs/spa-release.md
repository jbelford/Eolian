# Production SPA release

The browser application is released independently from the Node application image. The
`Release production SPA` GitHub Actions workflow builds `dist/public`, deploys it to Azure Storage,
purges Azure Front Door, and verifies the public read-only routes. The backend image workflow
continues to build and deploy only `dist/bundle.js`.

The Azure resources and role assignments are managed by a separate infrastructure layer. This
repository consumes the resource names and deployment identity through the documented production
environment variables; it does not create or modify infrastructure.

## Production environment

Create a protected GitHub environment named `production` and configure these Actions variables:

| Variable                   | Purpose                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `AZURE_CLIENT_ID`          | Client ID for the federated deployment identity.                 |
| `AZURE_TENANT_ID`          | Microsoft Entra tenant ID for OIDC login.                        |
| `AZURE_SUBSCRIPTION_ID`    | Subscription containing the production resources.                |
| `AZURE_RESOURCE_GROUP`     | Resource group containing the Front Door profile.                |
| `SPA_STORAGE_ACCOUNT_NAME` | Storage account whose `$web` container hosts the production SPA. |
| `FRONT_DOOR_PROFILE_NAME`  | Azure Front Door Standard or Premium profile.                    |
| `FRONT_DOOR_ENDPOINT_NAME` | Front Door endpoint serving the production application routes.   |

The browser build uses the public Discord client ID committed in `.env.production` by default.
Optionally set the production-environment Actions variable `VITE_DISCORD_CLIENT_ID` to a valid
Discord snowflake to override that default. The workflow passes a nonempty override to the build
only after validation; an unset or blank variable leaves the committed value intact.

Vite embeds `VITE_` variables into the public browser bundle **at build time**, not at runtime.
Changing the override or committed default requires rebuilding and redeploying the SPA. Never put
secrets in `VITE_` values; anyone can inspect them in the delivered JavaScript.

The environment's federated identity must trust this repository's `production` environment. It
requires Storage Blob Data Contributor scoped to the `$web` container and CDN Profile Contributor
scoped to the configured Front Door profile. Account keys, SAS tokens, publish profiles, and stored
Azure credentials are not used.

The storage account must have static website hosting enabled with `index.html` as the document. The
Front Door endpoint must route the SPA, extensionless browser paths, `/healthz`, and `/api/*` to
their appropriate origins. Before selecting the canonical smoke target, configure
`www.eolianbot.com` as an active Front Door custom domain.

## Release sequence

Run **Release production SPA** manually and choose the smoke target:

- `front-door-default` is the safe default before DNS cutover. The workflow discovers the
  endpoint's Azure hostname from the configured Front Door profile and endpoint.
- `canonical` verifies `https://www.eolianbot.com` after its DNS and Front Door custom-domain
  configuration are active.

The workflow uses Node.js 24.21.0 and the checksum-pinned Yarn 4.4.1 release, installs dependencies
with `yarn install --immutable`, runs the browser tests and typecheck, and creates a production
`build:web`. It then authenticates to Azure with GitHub OIDC and performs these operations in
order:

1. Upload files under `dist/public/assets` with immutable caching after verifying that every asset
   name contains a Vite content hash.
2. Upload any remaining non-hashed shell files except `index.html`.
3. Upload `index.html` last.
4. Wait for an Azure Front Door `/*` purge to complete.
5. Retry read-only smoke checks for the root document, `/sign-in`, `/healthz`, and
   `/api/auth/session`.

The root and extensionless `/sign-in` responses must be HTML byte-for-byte equal to the generated
`index.html`. The health response must be `text/plain` with the expected body, and the unauthenticated
session response must be valid JSON. A failed build, upload, purge, or smoke check fails the release;
the success summary is written only after all checks pass.

## Cache policy

Content-hashed files under `assets/` use
`Cache-Control: public, max-age=31536000, immutable`. They are uploaded before the HTML shell and
are not deleted during a release, so clients that still hold an older shell can continue loading
the assets it references.

Other non-hashed shell files use `Cache-Control: no-cache, must-revalidate`. `index.html` uses
`Cache-Control: no-cache, no-store, must-revalidate` and is uploaded last so it never points to
assets that have not been published. The upload script sets content types from file extensions
rather than relying on storage defaults.

## Redeploy and rollback

Re-running the workflow for the same Git ref is a safe redeploy: blobs are overwritten with the
same build output, Front Door is purged, and all smoke checks run again.

To roll back, dispatch the workflow from a branch or tag that points to the desired application
commit. The workflow rebuilds that revision and uploads its `index.html` last. Previously released
content-hashed assets remain available in `$web`, so the older shell can reference its original
asset URLs without an asset restore step. A later maintenance operation may remove unreferenced
hashed assets, but cleanup must not run as part of a release.
