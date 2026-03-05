// Shared helper for generating webview HTML content
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generates the HTML content for a webview panel
 * @param webview The webview instance
 * @param extensionUri The extension URI for resource paths
 * @param scriptName The name of the bundled script (e.g., 'document', 'trace-graph', 'matrix')
 * @param title The title of the webview
 */
export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  scriptName: string,
  title: string,
  data?: Record<string, string>
): string {
  // Get the URI for the bundled script
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', `${scriptName}.js`)
  );

  // Check if there's a CSS file for this bundle
  const cssPath = path.join(extensionUri.fsPath, 'dist', `${scriptName}.css`);
  let cssLink = '';
  if (fs.existsSync(cssPath)) {
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', `${scriptName}.css`)
    );
    cssLink = `<link rel="stylesheet" href="${cssUri}">`;
  }

  // Use a nonce for security
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data: blob:;">
  <title>${title}</title>
  ${cssLink}
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: auto;
    }
    #root {
      width: 100%;
      min-height: 100%;
    }
  </style>
</head>
<body>
  <div id="root"></div>${data ? `
  <script nonce="${nonce}">window.__WEBVIEW_DATA__=${JSON.stringify(data)};</script>` : ''}
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

/**
 * Generates a random nonce for Content Security Policy
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
