import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { getXtermTheme, watchThemeChanges } from './terminalTheme';
import { InputHandler } from './inputHandler';
import { getVsCodeApi } from '../shared/vscodeApi';
import { MarkdownRenderer } from './markdownRenderer';

// ANSI escape helpers
const DIM = '\x1b[2m';
const DIM_ITALIC = '\x1b[2;3m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

export function createAgentTerminal(container: HTMLElement): void {
  const vscode = getVsCodeApi();
  const fitAddon = new FitAddon();

  const terminal = new Terminal({
    theme: getXtermTheme(),
    fontFamily: 'var(--vscode-editor-font-family, "Cascadia Code", Menlo, Monaco, monospace)',
    fontSize: 13,
    lineHeight: 1.4,
    cursorBlink: true,
    cursorStyle: 'bar',
    scrollback: 5000,
    convertEol: true,
  });

  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon());

  terminal.open(container);
  fitAddon.fit();

  // Streaming state
  let currentStreamId: string | null = null;
  let mdRenderer: MarkdownRenderer | null = null;
  let autoApprove = false;

  const inputHandler = new InputHandler(terminal, {
    onSubmit(text: string) {
      inputHandler.setLoading();
      vscode.postMessage({ type: 'sendPrompt', payload: { text } });
    },
    onChangeDecision(decision: 'accept' | 'reject' | 'allow_all', changeId: string) {
      if (decision === 'accept') {
        vscode.postMessage({ type: 'acceptChange', payload: { changeId } });
      } else if (decision === 'reject') {
        vscode.postMessage({ type: 'rejectChange', payload: { changeId } });
      } else if (decision === 'allow_all') {
        autoApprove = true;
        vscode.postMessage({ type: 'allowAllChanges' });
        vscode.postMessage({ type: 'acceptChange', payload: { changeId } });
      }
    },
  });
  inputHandler.attach();

  // Welcome banner
  terminal.writeln(`${BOLD}RQML Agent${RESET}`);
  terminal.writeln(`${DIM_ITALIC}Ask about your requirements, request quality assessments,${RESET}`);
  terminal.writeln(`${DIM_ITALIC}or let the agent monitor your spec.${RESET}`);
  terminal.writeln('');

  // Request initial endpoint status
  vscode.postMessage({ type: 'requestEndpoints' });

  // Handle messages from extension
  window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data;
    switch (msg.type) {
      case 'agentStreaming': {
        const { id, content } = msg.payload as { id: string; content: string };
        if (currentStreamId !== id) {
          currentStreamId = id;
          mdRenderer = new MarkdownRenderer(terminal);
          inputHandler.clearLoading();
        }
        mdRenderer!.update(content);
        break;
      }

      case 'agentStreamEnd': {
        const { id, content, change } = msg.payload as {
          id: string;
          content: string;
          change?: { changeId: string; description: string; diff?: string; status: string };
        };

        if (!mdRenderer) {
          mdRenderer = new MarkdownRenderer(terminal);
        }
        mdRenderer.finish(content);
        mdRenderer = null;
        currentStreamId = null;

        // Handle change proposal
        if (change && change.status === 'pending' && !autoApprove) {
          inputHandler.showChangePrompt(change.changeId, change.diff || change.description);
        } else {
          inputHandler.showPrompt();
        }
        break;
      }

      case 'agentResponse': {
        inputHandler.clearLoading();
        const { content } = msg.payload as { content: string };
        const r = new MarkdownRenderer(terminal);
        r.finish(content);
        terminal.writeln('');
        currentStreamId = null;
        mdRenderer = null;
        inputHandler.showPrompt();
        break;
      }

      case 'systemMessage': {
        const { content } = msg.payload as { content: string };
        terminal.writeln(`${DIM_ITALIC}${content}${RESET}`);
        break;
      }

      case 'endpointStatus': {
        const { configured, name, provider } = msg.payload as {
          configured: boolean;
          name?: string;
          provider?: string;
        };
        if (configured) {
          terminal.writeln(`${DIM}Endpoint: ${name} (${provider})${RESET}`);
          terminal.writeln('');
          inputHandler.setConfigured();
          inputHandler.showPrompt();
        } else {
          inputHandler.setNotConfigured();
        }
        break;
      }

      case 'changeApplied': {
        terminal.writeln(`${GREEN}Change applied.${RESET}`);
        inputHandler.showPrompt();
        break;
      }

      case 'changeRejected': {
        terminal.writeln(`${YELLOW}Change rejected.${RESET}`);
        inputHandler.showPrompt();
        break;
      }
    }
  });

  // Auto-fit on container resize
  const resizeObserver = new ResizeObserver(() => {
    fitAddon.fit();
  });
  resizeObserver.observe(container);

  // Live theme updates
  watchThemeChanges(terminal);
}