// VS Code Webview API wrapper
// Provides type-safe access to the VS Code API from within webviews

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// Singleton instance
let vscodeApi: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

// Message types for communication with extension
export interface WebviewMessage {
  type: string;
  payload?: unknown;
}

export function postMessage(message: WebviewMessage): void {
  getVsCodeApi().postMessage(message);
}

// Navigate to a location in the RQML file
export function navigateToItem(itemId: string): void {
  postMessage({ type: 'navigateToItem', payload: { itemId } });
}

// Request refresh of data
export function requestRefresh(): void {
  postMessage({ type: 'requestRefresh' });
}
