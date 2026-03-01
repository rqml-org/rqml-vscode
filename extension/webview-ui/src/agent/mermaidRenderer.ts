// Mermaid.js initialization and rendering for the agent chat webview.
// Standalone module — not a React hook. Import from any component.

import mermaid from 'mermaid';

let initialized = false;
let renderCounter = 0;

export interface MermaidThemeVars {
  isDark: boolean;
  foreground: string;
  background: string;
  primaryColor: string;
  primaryTextColor: string;
  lineColor: string;
}

export function initMermaid(themeVars: MermaidThemeVars): void {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      darkMode: themeVars.isDark,
      background: themeVars.background,
      primaryColor: themeVars.primaryColor,
      primaryTextColor: themeVars.primaryTextColor,
      primaryBorderColor: themeVars.lineColor,
      lineColor: themeVars.lineColor,
      textColor: themeVars.foreground,
      mainBkg: themeVars.background,
      nodeBorder: themeVars.lineColor,
      clusterBkg: themeVars.background,
      titleColor: themeVars.foreground,
      edgeLabelBackground: themeVars.background,
    },
    securityLevel: 'strict',
    fontFamily: 'var(--vscode-font-family, system-ui)',
    fontSize: 14,
  });
  initialized = true;
}

export function updateMermaidTheme(themeVars: MermaidThemeVars): void {
  initMermaid(themeVars);
}

export async function renderMermaidDiagram(
  source: string
): Promise<{ svg: string } | { error: string }> {
  if (!initialized) {
    return { error: 'Mermaid not initialized' };
  }

  const id = `mermaid-diagram-${++renderCounter}`;

  try {
    const { svg } = await mermaid.render(id, source);
    return { svg };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    // Extract just the first line of parse errors — the full dump is too noisy
    const firstLine = raw.split('\n')[0];
    const short = firstLine.length > 120 ? firstLine.slice(0, 120) + '...' : firstLine;
    return { error: short || 'Failed to render diagram' };
  }
}
