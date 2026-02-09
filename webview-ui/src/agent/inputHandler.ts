import type { Terminal } from '@xterm/xterm';

type InputMode = 'idle' | 'loading' | 'change_pending' | 'not_configured';

interface InputHandlerOptions {
  onSubmit: (text: string) => void;
  onChangeDecision: (decision: 'accept' | 'reject' | 'allow_all', changeId: string) => void;
}

const PROMPT = '\x1b[36m\u276f\x1b[0m ';
const CONTINUATION = '\x1b[2m...\x1b[0m ';
const SPINNER_FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];

export class InputHandler {
  private mode: InputMode = 'not_configured';
  private inputBuffer = '';
  private spinnerInterval: ReturnType<typeof setInterval> | null = null;
  private pendingChangeId: string | null = null;

  constructor(
    private terminal: Terminal,
    private options: InputHandlerOptions
  ) {
    this.attachKeyHandler();
  }

  /** Attach to terminal input events */
  attach(): void {
    this.terminal.onData((data) => this.handleData(data));
  }

  /** Show prompt and enter idle mode */
  showPrompt(): void {
    this.mode = 'idle';
    this.inputBuffer = '';
    this.terminal.write(PROMPT);
  }

  /** Enter loading state with spinner */
  setLoading(): void {
    this.mode = 'loading';
    let frame = 0;
    this.terminal.write('\r\n');
    this.spinnerInterval = setInterval(() => {
      this.terminal.write(
        `\r\x1b[2K\x1b[2m${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]} Agent thinking...\x1b[0m`
      );
      frame++;
    }, 80);
  }

  /** Stop loading and clear spinner line */
  clearLoading(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
    this.terminal.write('\r\x1b[2K');
  }

  /** Show change proposal prompt */
  showChangePrompt(changeId: string, description: string): void {
    this.mode = 'change_pending';
    this.pendingChangeId = changeId;
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[1;33m--- Proposed Change ---\x1b[0m');
    // Wrap description lines
    const lines = description.split('\n');
    for (const line of lines) {
      this.terminal.writeln(`\x1b[2m${line}\x1b[0m`);
    }
    this.terminal.write('\x1b[1mApply? [y]es / [n]o / [a]llow-all: \x1b[0m');
  }

  /** Show not-configured message */
  setNotConfigured(): void {
    this.mode = 'not_configured';
    this.terminal.writeln('\x1b[2;3mNo LLM endpoint configured.\x1b[0m');
    this.terminal.writeln('\x1b[2;3mUse "RQML: Add LLM Endpoint" from the command palette.\x1b[0m');
  }

  /** Transition from not-configured to idle */
  setConfigured(): void {
    if (this.mode === 'not_configured') {
      this.mode = 'idle';
    }
  }

  /** Intercept Shift+Enter for multiline input */
  private attachKeyHandler(): void {
    this.terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.key === 'Enter' && event.shiftKey && event.type === 'keydown') {
        if (this.mode === 'idle') {
          this.inputBuffer += '\n';
          this.terminal.write('\r\n');
          this.terminal.write(CONTINUATION);
        }
        return false;
      }
      return true;
    });
  }

  private handleData(data: string): void {
    switch (this.mode) {
      case 'idle':
        this.handleIdleInput(data);
        break;
      case 'change_pending':
        this.handleChangeInput(data);
        break;
      // loading and not_configured: ignore input
    }
  }

  private handleIdleInput(data: string): void {
    // Enter
    if (data === '\r') {
      const text = this.inputBuffer.trim();
      if (text) {
        this.terminal.write('\r\n');
        this.options.onSubmit(text);
      }
      return;
    }

    // Backspace
    if (data === '\x7f') {
      if (this.inputBuffer.length > 0) {
        this.inputBuffer = this.inputBuffer.slice(0, -1);
        this.terminal.write('\b \b');
      }
      return;
    }

    // Ctrl+C: cancel input
    if (data === '\x03') {
      this.inputBuffer = '';
      this.terminal.write('^C\r\n');
      this.showPrompt();
      return;
    }

    // Ignore other control characters (except tab)
    if (data.charCodeAt(0) < 32 && data !== '\t') {
      return;
    }

    // Regular character(s) - handles paste as well
    this.inputBuffer += data;
    this.terminal.write(data);
  }

  private handleChangeInput(data: string): void {
    const key = data.toLowerCase();
    const changeId = this.pendingChangeId;
    if (!changeId) return;

    if (key === 'y') {
      this.terminal.writeln('y');
      this.terminal.writeln('\x1b[32mChange accepted.\x1b[0m');
      this.options.onChangeDecision('accept', changeId);
      this.pendingChangeId = null;
      this.showPrompt();
    } else if (key === 'n') {
      this.terminal.writeln('n');
      this.terminal.writeln('\x1b[31mChange rejected.\x1b[0m');
      this.options.onChangeDecision('reject', changeId);
      this.pendingChangeId = null;
      this.showPrompt();
    } else if (key === 'a') {
      this.terminal.writeln('a');
      this.terminal.writeln('\x1b[33mAuto-approve enabled for this session.\x1b[0m');
      this.options.onChangeDecision('allow_all', changeId);
      this.pendingChangeId = null;
      this.showPrompt();
    }
  }
}