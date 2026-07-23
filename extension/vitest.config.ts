import { defineConfig } from 'vitest/config';

// Unit tests only. Anything importing `vscode` cannot run here — it needs a real
// extension host, so it lives in src/test/integration/ and runs under
// @vscode/test-electron instead. Keeping the two apart is what lets the bulk of
// the codebase be tested in a second rather than a minute.
export default defineConfig({
  test: {
    include: ['src/test/unit/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
  },
});
