// Lightweight diagnostic logger that writes to a dedicated VS Code Output channel.
// Visible to the user via "View → Output → RQML".

import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('RQML');
  }
  return channel;
}

function ts(): string {
  const d = new Date();
  return `${d.toTimeString().slice(0, 8)}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

export const log = {
  info(area: string, message: string, data?: unknown): void {
    const line = `[${ts()}] [${area}] ${message}`;
    if (data !== undefined) {
      try {
        getChannel().appendLine(`${line}  ${JSON.stringify(data)}`);
      } catch {
        getChannel().appendLine(`${line}  ${String(data)}`);
      }
    } else {
      getChannel().appendLine(line);
    }
  },
  error(area: string, message: string, err?: unknown): void {
    const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    getChannel().appendLine(`[${ts()}] [${area}] ERROR: ${message}\n${detail}`);
  },
  show(): void {
    getChannel().show(true);
  },
};
