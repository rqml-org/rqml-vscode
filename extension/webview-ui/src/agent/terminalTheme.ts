import type { Terminal, ITheme } from '@xterm/xterm';

function css(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function getXtermTheme(): ITheme {
  return {
    background: css('--vscode-terminal-background', css('--vscode-panel-background', '#1e1e1e')),
    foreground: css('--vscode-terminal-foreground', css('--vscode-foreground', '#cccccc')),
    cursor: css('--vscode-terminalCursor-foreground', '#ffffff'),
    cursorAccent: css('--vscode-terminalCursor-background', '#000000'),
    selectionBackground: css('--vscode-terminal-selectionBackground', '#264f78'),
    selectionForeground: css('--vscode-terminal-selectionForeground', ''),
    black: css('--vscode-terminal-ansiBlack', '#000000'),
    red: css('--vscode-terminal-ansiRed', '#cd3131'),
    green: css('--vscode-terminal-ansiGreen', '#0dbc79'),
    yellow: css('--vscode-terminal-ansiYellow', '#e5e510'),
    blue: css('--vscode-terminal-ansiBlue', '#2472c8'),
    magenta: css('--vscode-terminal-ansiMagenta', '#bc3fbc'),
    cyan: css('--vscode-terminal-ansiCyan', '#11a8cd'),
    white: css('--vscode-terminal-ansiWhite', '#e5e5e5'),
    brightBlack: css('--vscode-terminal-ansiBrightBlack', '#666666'),
    brightRed: css('--vscode-terminal-ansiBrightRed', '#f14c4c'),
    brightGreen: css('--vscode-terminal-ansiBrightGreen', '#23d18b'),
    brightYellow: css('--vscode-terminal-ansiBrightYellow', '#f5f543'),
    brightBlue: css('--vscode-terminal-ansiBrightBlue', '#3b8eea'),
    brightMagenta: css('--vscode-terminal-ansiBrightMagenta', '#d670d6'),
    brightCyan: css('--vscode-terminal-ansiBrightCyan', '#29b8db'),
    brightWhite: css('--vscode-terminal-ansiBrightWhite', '#e5e5e5'),
  };
}

export function watchThemeChanges(terminal: Terminal): () => void {
  const observer = new MutationObserver(() => {
    terminal.options.theme = getXtermTheme();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style', 'class'],
  });
  return () => observer.disconnect();
}