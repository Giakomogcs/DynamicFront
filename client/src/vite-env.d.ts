/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RESOURCE_BASE_URL: string
  readonly VITE_USER_MANAGER_TOKEN: string
  readonly VITE_RESOURCE_API_KEY: string
  readonly VITE_LOG_LEVEL: string
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
