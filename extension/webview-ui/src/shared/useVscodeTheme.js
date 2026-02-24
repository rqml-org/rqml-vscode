"use strict";
// VS Code theme integration for webviews
// Uses CSS custom properties set by VS Code
Object.defineProperty(exports, "__esModule", { value: true });
exports.useVscodeTheme = useVscodeTheme;
exports.createThemedStyles = createThemedStyles;
const react_1 = require("react");
function getCssVariable(name, fallback) {
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
    return value || fallback;
}
function getThemeFromCss() {
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
function useVscodeTheme() {
    const [theme, setTheme] = (0, react_1.useState)(getThemeFromCss);
    (0, react_1.useEffect)(() => {
        // Listen for theme changes via MutationObserver on style attribute
        const observer = new MutationObserver(() => {
            setTheme(getThemeFromCss());
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['style', 'class'],
        });
        // Also handle the custom theme change event if VS Code sends one
        const handleMessage = (event) => {
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
function createThemedStyles(createStyles) {
    return createStyles;
}
//# sourceMappingURL=useVscodeTheme.js.map