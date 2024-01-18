// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/// <reference types="vitest" />
import path from 'path';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [dts()],
  build: {
    sourcemap: true,
    minify: false,
    lib: {
      entry: path.resolve(__dirname, `src/postgrest-client.ts`),
      formats: ['es', 'cjs'],
    },
  },
  test: {
    watch: false,
    coverage: {
      lines: 99,
      functions: 100,
      branches: 97,
      statements: 99,
    },
  },
});
