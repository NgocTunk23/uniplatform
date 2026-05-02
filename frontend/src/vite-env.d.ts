/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  // Thêm các biến môi trường khác của bạn ở đây...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}