# Production SPA release

The browser application is released independently from the Node application image. The
`Release production SPA` GitHub Actions workflow builds `dist/public`, deploys it to Azure Storage,
and purges Azure Front Door. The backend image workflow continues to build and deploy only
`dist/bundle.js`.

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

The browser build uses the public Discord client ID committed in `web/.env.production`. Vite embeds
`VITE_` values into the public browser bundle **at build time**, not at runtime. Changing the ID in
the env file requires rebuilding and redeploying the SPA. Never put secrets in `VITE_` values;
anyone can inspect them in the delivered JavaScript.

The environment's federated identity must trust this repository's `production` environment. It
requires Storage Blob Data Contributor scoped to the `$web` container and CDN Profile Contributor
scoped to the configured Front Door profile. Account keys, SAS tokens, publish profiles, and stored
Azure credentials are not used.

The storage account must have static website hosting enabled with `index.html` as the document. The
Front Door endpoint must route the SPA, extensionless browser paths, `/healthz`, and `/api/*` to
their appropriate origins. Configure `www.eolianbot.com` as an active Front Door custom domain
before DNS cutover.

## Release sequence

Run **Release production SPA** manually. The release does not depend on production DNS and can run
before or after cutover.

The workflow uses Node.js 24.21.0 and the checksum-pinned Yarn 4.4.1 release, installs dependencies
with `yarn install --immutable`, runs the browser tests and typecheck, and creates a production
`build:web`. It then authenticates to Azure with GitHub OIDC and performs these operations in
order:

1. Verify that the output contains `index.html` and only hashed JavaScript, CSS, and PNG assets.
2. Upload `dist/public/assets` in three Azure CLI batches with type-specific content types and
   immutable caching.
3. Upload `index.html` last with a no-store cache header.
4. Wait for an Azure Front Door `/*` purge to complete.

A failed build, upload, or purge fails the release; the success summary is written only after
these steps pass. The workflow does not perform post-deployment smoke checks.

## Cache policy

Content-hashed files under `assets/` use
`Cache-Control: public, max-age=31536000, immutable`. They are uploaded before the HTML shell and
are not deleted during a release, so clients that still hold an older shell can continue loading
the assets it references.

`index.html` uses `Cache-Control: no-cache, no-store, must-revalidate` and is uploaded last so it
never points to assets that have not been published. The workflow sets the content type explicitly
for each supported file type. If the build starts emitting another asset type, add its upload batch
before releasing it.

## Redeploy and rollback

Re-running the workflow for the same Git ref is a safe redeploy: blobs are overwritten with the
same build output and Front Door is purged.

To roll back, dispatch the workflow from a branch or tag that points to the desired application
commit. The workflow rebuilds that revision and uploads its `index.html` last. Previously released
content-hashed assets remain available in `$web`, so the older shell can reference its original
asset URLs without an asset restore step. A later maintenance operation may remove unreferenced
hashed assets, but cleanup must not run as part of a release.
