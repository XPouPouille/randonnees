/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IGN_MODE?: string;
  readonly VITE_IGN_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
