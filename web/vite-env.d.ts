/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISCORD_CLIENT_ID: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
