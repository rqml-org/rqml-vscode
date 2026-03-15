// Build script for RQML webview bundles
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isWatch = process.argv.includes('--watch');

// Ensure dist directory exists
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Common build options for all webview bundles
const commonOptions = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch,
  target: ['es2020'],
  format: 'iife',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
  },
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
};

// Webview entry points
const webviews = [
  {
    name: 'document',
    entry: 'webview-ui/src/document/index.tsx',
    outfile: 'dist/document.js',
  },
  {
    name: 'trace-graph',
    entry: 'webview-ui/src/trace-graph/index.tsx',
    outfile: 'dist/trace-graph.js',
  },
  {
    name: 'matrix',
    entry: 'webview-ui/src/matrix/index.tsx',
    outfile: 'dist/matrix.js',
  },
  {
    name: 'agent',
    entry: 'webview-ui/src/agent/index.tsx',
    outfile: 'dist/agent.js',
  },
  {
    name: 'export',
    entry: 'webview-ui/src/export/index.tsx',
    outfile: 'dist/export.js',
  },
];

async function build() {
  // Check if webview-ui exists
  const webviewUiDir = path.join(__dirname, 'webview-ui');
  if (!fs.existsSync(webviewUiDir)) {
    console.log('webview-ui directory not found, skipping webview build');
    return;
  }

  const buildPromises = webviews.map(async (webview) => {
    const entryPath = path.join(__dirname, webview.entry);

    // Skip if entry point doesn't exist yet
    if (!fs.existsSync(entryPath)) {
      console.log(`Skipping ${webview.name}: entry point not found`);
      return;
    }

    try {
      if (isWatch) {
        const ctx = await esbuild.context({
          ...commonOptions,
          entryPoints: [entryPath],
          outfile: path.join(__dirname, webview.outfile),
        });
        await ctx.watch();
        console.log(`Watching ${webview.name}...`);
      } else {
        await esbuild.build({
          ...commonOptions,
          entryPoints: [entryPath],
          outfile: path.join(__dirname, webview.outfile),
        });
        console.log(`Built ${webview.name}`);
      }
    } catch (err) {
      console.error(`Error building ${webview.name}:`, err);
      process.exit(1);
    }
  });

  await Promise.all(buildPromises);

  if (!isWatch) {
    console.log('Webview build complete');
  }
}

build();
