// VS Code theme integration for webviews
// Uses CSS custom properties set by VS Code

import { useEffect, useState } from 'react';

export interface VscodeTheme {
  // Core colors
  foreground: string;
  background: string;

  // Editor colors
  editorBackground: string;
  editorForeground: string;

  // Button colors
  buttonBackground: string;
  buttonForeground: string;
  buttonHoverBackground: string;

  // Input colors
  inputBackground: string;
  inputForeground: string;
  inputBorder: string;

  // List colors
  listActiveSelectionBackground: string;
  listActiveSelectionForeground: string;
  listHoverBackground: string;

  // Panel colors
  panelBorder: string;

  // Status colors
  errorForeground: string;
  warningForeground: string;

  // Font
  fontFamily: string;
  fontSize: string;
}

function getCssVariable(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function getThemeFromCss(): VscodeTheme {
  return {
    foreground: getCssVariable('--vscode-foreground', '#cccccc'),
    background: getCssVariable('--vscode-editor-background', '#1e1e1e'),
    editorBackground: getCssVariable('--vscode-editor-background', '#1e1e1e'),
    editorForeground: getCssVariable('--vscode-editor-foreground', '#cccccc'),
    buttonBackground: getCssVariable('--vscode-button-background', '#0e639c'),
    buttonForeground: getCssVariable('--vscode-button-foreground', '#ffffff'),
    buttonHoverBackground: getCssVariable('--vscode-button-hoverBackground', '#1177bb'),
    inputBackground: getCssVariable('--vscode-input-background', '#3c3c3c'),
    inputForeground: getCssVariable('--vscode-input-foreground', '#cccccc'),
    inputBorder: getCssVariable('--vscode-input-border', '#3c3c3c'),
    listActiveSelectionBackground: getCssVariable('--vscode-list-activeSelectionBackground', '#094771'),
    listActiveSelectionForeground: getCssVariable('--vscode-list-activeSelectionForeground', '#ffffff'),
    listHoverBackground: getCssVariable('--vscode-list-hoverBackground', '#2a2d2e'),
    panelBorder: getCssVariable('--vscode-panel-border', '#80808059'),
    errorForeground: getCssVariable('--vscode-errorForeground', '#f48771'),
    warningForeground: getCssVariable('--vscode-editorWarning-foreground', '#cca700'),
    fontFamily: getCssVariable('--vscode-font-family', 'system-ui'),
    fontSize: getCssVariable('--vscode-font-size', '13px'),
  };
}

export function useVscodeTheme(): VscodeTheme {
  const [theme, setTheme] = useState<VscodeTheme>(getThemeFromCss);

  useEffect(() => {
    // Listen for theme changes via MutationObserver on style attribute
    const observer = new MutationObserver(() => {
      setTheme(getThemeFromCss());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    // Also handle the custom theme change event if VS Code sends one
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === 'themeChanged') {
        setTheme(getThemeFromCss());
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      observer.disconnect();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return theme;
}

// Utility to create CSS-in-JS styles from theme
export function createThemedStyles<T extends Record<string, React.CSSProperties>>(
  createStyles: (theme: VscodeTheme) => T
): (theme: VscodeTheme) => T {
  return createStyles;
}
