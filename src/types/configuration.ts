// REQ-CFG-004, REQ-CFG-005, REQ-CFG-006: Configuration types for RQML extension

/**
 * REQ-CFG-004: Supported LLM providers
 */
export type LlmProvider = 'openai' | 'anthropic' | 'azure-openai' | 'ollama' | 'none';

/**
 * REQ-CFG-003: Secret keys stored in SecretStorage
 */
export type SecretKey =
  | 'openai-api-key'
  | 'anthropic-api-key'
  | 'azure-openai-api-key'
  | 'azure-openai-endpoint';

/**
 * REQ-CFG-005, REQ-CFG-006: Color palette configuration
 */
export interface ColorPalette {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    accent: string;
    success: string;
  };
}

/**
 * REQ-CFG-006: Default RQML color palette
 * Colors: Lavender Purple, Carbon Black, White Smoke, Pumpkin Spice, Sage Green
 */
export const DEFAULT_COLOR_PALETTE: ColorPalette = {
  id: 'rqml-default',
  name: 'RQML Default',
  colors: {
    primary: '#8568ab',    // Lavender Purple
    secondary: '#191716',  // Carbon Black
    background: '#f5f3f5', // White Smoke
    accent: '#fc7a1e',     // Pumpkin Spice
    success: '#60a561'     // Sage Green
  }
};

/**
 * All available color palettes
 */
export const COLOR_PALETTES: ColorPalette[] = [
  DEFAULT_COLOR_PALETTE
];

/**
 * Configuration section name in VS Code settings
 */
export const CONFIGURATION_SECTION = 'rqml';
