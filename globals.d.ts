// Global type declarations for missing third‑party modules used in the cloned demo repos
// This helps the TypeScript compiler succeed without installing the full packages.

declare module '@deck.gl/react';
declare module '@deck.gl/layers';
declare module '@deck.gl/aggregation-layers';
declare module '@deck.gl/core';
declare module 'react-map-gl/maplibre';
declare module 'vite';
declare module '@vitejs/plugin-react';
declare module 'react-dom/client';

// Augment the ImportMetaEnv interface for VITE_ variables used in CrisisFlow
interface ImportMetaEnv {
  VITE_API_URL: string;
  // add other VITE_ variables here as needed
}

interface ImportMeta {
  env: ImportMetaEnv;
}

