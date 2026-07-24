import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	// Integration tests only. Unit tests live in src/test/unit and run under
	// vitest — they must not be launched in the extension host, where their
	// `vitest` import does not resolve.
	files: 'out/test/integration/**/*.test.js',

	// Pin to the version the manifest claims to support.
	//
	// Left unset, @vscode/test-cli downloads the newest stable that satisfies
	// engines.vscode — currently ~22 releases above the declared floor. That
	// tests a version we do not promise and never tests the one we do, so an
	// accidental use of a newer API would pass CI and fail for the users the
	// floor exists to protect. Raise this in step with engines.vscode.
	version: '1.108.1',
});
