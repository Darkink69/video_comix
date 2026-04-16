/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // другие переменные окружения...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Для CSS файлов
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

// Для изображений
declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const value: string;
  export default value;
}
