// REQ-CMD-003: Clickable requirement ID references in terminal output

import type { Terminal, ILinkProvider, ILink, IBufferRange } from '@xterm/xterm';
import { getVsCodeApi } from '../shared/vscodeApi';

/**
 * Pattern matching requirement-style IDs: REQ-XXX-NNN, GOAL-XXX, TR-NNN, etc.
 * Matches common RQML ID patterns with alphanumeric segments separated by hyphens.
 */
const REQ_ID_PATTERN = /\b(REQ|GOAL|SC|BEH|IF|TC|TR|DD|PKG|AC|UXR)-[A-Z0-9]+-?[A-Z0-9]*/g;

/**
 * Register a custom link provider that makes requirement IDs clickable.
 * Clicking a requirement ID sends a message to the extension to navigate to it.
 */
export function registerLinkHandler(terminal: Terminal): void {
  const vscode = getVsCodeApi();

  const provider: ILinkProvider = {
    provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): void {
      const line = terminal.buffer.active.getLine(bufferLineNumber - 1);
      if (!line) {
        callback(undefined);
        return;
      }

      const text = line.translateToString(true);
      const links: ILink[] = [];

      let match: RegExpExecArray | null;
      REQ_ID_PATTERN.lastIndex = 0;

      while ((match = REQ_ID_PATTERN.exec(text)) !== null) {
        const startCol = match.index + 1; // 1-indexed
        const endCol = startCol + match[0].length;

        const range: IBufferRange = {
          start: { x: startCol, y: bufferLineNumber },
          end: { x: endCol, y: bufferLineNumber },
        };

        const reqId = match[0];
        links.push({
          range,
          text: reqId,
          decorations: {
            pointerCursor: true,
            underline: true,
          },
          activate(_event: MouseEvent, text: string) {
            vscode.postMessage({
              type: 'navigateToRequirement',
              payload: { id: text }
            });
          },
        });
      }

      callback(links.length > 0 ? links : undefined);
    },
  };

  terminal.registerLinkProvider(provider);
}

const COPY_LABEL = '[Copy to clipboard]';

/**
 * Register a link provider for the "[Copy to clipboard]" action.
 * Returns a setter so the caller can update the content to copy.
 */
export function registerCopyLinkHandler(terminal: Terminal): {
  setCopyContent(content: string): void;
} {
  const vscode = getVsCodeApi();
  let copyContent = '';

  const provider: ILinkProvider = {
    provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): void {
      const line = terminal.buffer.active.getLine(bufferLineNumber - 1);
      if (!line) { callback(undefined); return; }

      const text = line.translateToString(true);
      const idx = text.indexOf(COPY_LABEL);
      if (idx === -1) { callback(undefined); return; }

      const range: IBufferRange = {
        start: { x: idx + 1, y: bufferLineNumber },
        end: { x: idx + COPY_LABEL.length + 1, y: bufferLineNumber },
      };

      callback([{
        range,
        text: COPY_LABEL,
        decorations: { pointerCursor: true, underline: true },
        activate() {
          if (copyContent) {
            vscode.postMessage({
              type: 'copyToClipboard',
              payload: { content: copyContent },
            });
          }
        },
      }]);
    },
  };

  terminal.registerLinkProvider(provider);

  return {
    setCopyContent(content: string) {
      copyContent = content;
    },
  };
}
