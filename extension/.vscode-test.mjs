import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	// Integration tests only. Unit tests live in src/test/unit and run under
	// vitest — they must not be launched in the extension host, where their
	// `vitest` import does not resolve.
	files: 'out/test/integration/**/*.test.js',
});
