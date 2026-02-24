import type { Terminal } from '@xterm/xterm';
import { Autocomplete } from './autocomplete';

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
  private cursorPos = 0;
  private spinnerInterval: ReturnType<typeof setInterval> | null = null;
  private pendingChangeId: string | null = null;
  private autocomplete: Autocomplete;

  // Command history
  private history: string[] = [];
  private historyIndex = -1;
  private savedInput = '';

  constructor(
    private terminal: Terminal,
    private options: InputHandlerOptions
  ) {
    this.autocomplete = new Autocomplete(terminal);
    this.attachKeyHandler();
  }

  /** REQ-CMD-002: Set command names for autocomplete */
  setCommandNames(names: string[]): void {
    this.autocomplete.setCommandNames(names);
  }

  /** Attach to terminal input events */
  attach(): void {
    this.terminal.onData((data) => this.handleData(data));
  }

  /** Show prompt and enter idle mode */
  showPrompt(): void {
    this.mode = 'idle';
    this.inputBuffer = '';
    this.cursorPos = 0;
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

  /** Ensure the handler is ready for input. Clears spinner if running, shows prompt if not already idle. */
  ensureReady(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
      this.terminal.write('\r\x1b[2K');
    }
    if (this.mode !== 'idle') {
      this.showPrompt();
    }
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

  // ── Cursor movement helpers ──

  /** Move the terminal cursor to a new position within the input buffer */
  private moveCursorTo(pos: number): void {
    const clamped = Math.max(0, Math.min(pos, this.inputBuffer.length));
    const delta = clamped - this.cursorPos;
    if (delta < 0) {
      this.terminal.write(`\x1b[${-delta}D`);
    } else if (delta > 0) {
      this.terminal.write(`\x1b[${delta}C`);
    }
    this.cursorPos = clamped;
  }

  /** Insert text at the current cursor position */
  private insertText(text: string): void {
    const after = this.inputBuffer.slice(this.cursorPos);
    this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos) + text + after;
    this.cursorPos += text.length;
    this.terminal.write(text + after);
    if (after.length > 0) {
      this.terminal.write(`\x1b[${after.length}D`);
    }
  }

  /** Delete `count` characters before the cursor */
  private deleteBack(count: number): void {
    if (count <= 0 || this.cursorPos === 0) return;
    count = Math.min(count, this.cursorPos);
    const after = this.inputBuffer.slice(this.cursorPos);
    this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos - count) + after;
    this.cursorPos -= count;
    this.terminal.write(`\x1b[${count}D`);
    this.terminal.write(after + ' '.repeat(count));
    this.terminal.write(`\x1b[${after.length + count}D`);
  }

  /** Find start of the previous word boundary from a given position */
  private wordBoundaryLeft(pos: number): number {
    if (pos === 0) return 0;
    let i = pos - 1;
    // Skip spaces
    while (i > 0 && this.inputBuffer[i] === ' ') i--;
    // Skip word chars
    while (i > 0 && this.inputBuffer[i - 1] !== ' ') i--;
    return i;
  }

  /** Find end of the next word boundary from a given position */
  private wordBoundaryRight(pos: number): number {
    const len = this.inputBuffer.length;
    if (pos >= len) return len;
    let i = pos;
    // Skip word chars
    while (i < len && this.inputBuffer[i] !== ' ') i++;
    // Skip spaces
    while (i < len && this.inputBuffer[i] === ' ') i++;
    return i;
  }

  /** Update autocomplete — only show ghost when cursor is at the end of input */
  private updateAutocomplete(): void {
    if (this.cursorPos === this.inputBuffer.length) {
      this.autocomplete.update(this.inputBuffer);
    }
  }

  // ── Key event handling ──

  /** Intercept modifier key combos that xterm doesn't pass through onData */
  private attachKeyHandler(): void {
    this.terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type !== 'keydown') return true;

      // Shift+Enter: multiline input
      if (event.key === 'Enter' && event.shiftKey) {
        if (this.mode === 'idle') {
          this.autocomplete.clearGhost();
          // Move cursor to end before inserting newline
          this.moveCursorTo(this.inputBuffer.length);
          this.inputBuffer += '\n';
          this.cursorPos = this.inputBuffer.length;
          this.terminal.write('\r\n');
          this.terminal.write(CONTINUATION);
        }
        return false;
      }

      if (this.mode !== 'idle') return true;

      // Cmd+Left: move to beginning of input
      if (event.key === 'ArrowLeft' && event.metaKey && !event.altKey) {
        this.autocomplete.clearGhost();
        this.moveCursorTo(0);
        return false;
      }

      // Cmd+Right: move to end of input
      if (event.key === 'ArrowRight' && event.metaKey && !event.altKey) {
        this.autocomplete.clearGhost();
        this.moveCursorTo(this.inputBuffer.length);
        this.updateAutocomplete();
        return false;
      }

      // Option+Left: move one word left
      if (event.key === 'ArrowLeft' && event.altKey && !event.metaKey) {
        this.autocomplete.clearGhost();
        this.moveCursorTo(this.wordBoundaryLeft(this.cursorPos));
        return false;
      }

      // Option+Right: move one word right
      if (event.key === 'ArrowRight' && event.altKey && !event.metaKey) {
        this.autocomplete.clearGhost();
        this.moveCursorTo(this.wordBoundaryRight(this.cursorPos));
        this.updateAutocomplete();
        return false;
      }

      // Option+Backspace: delete previous word
      if (event.key === 'Backspace' && event.altKey && !event.metaKey) {
        if (this.cursorPos > 0) {
          this.autocomplete.clearGhost();
          const boundary = this.wordBoundaryLeft(this.cursorPos);
          this.deleteBack(this.cursorPos - boundary);
          this.updateAutocomplete();
        }
        return false;
      }

      return true;
    });
  }

  /** Replace the current input line with new text (cursor moves to end) */
  private replaceInput(text: string): void {
    this.autocomplete.clearGhost();
    // Move to start of input
    if (this.cursorPos > 0) {
      this.terminal.write(`\x1b[${this.cursorPos}D`);
    }
    // Write new text and clear any leftover characters
    this.terminal.write(text + '\x1b[K');
    this.inputBuffer = text;
    this.cursorPos = text.length;
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
    // Left arrow: move one character left
    if (data === '\x1b[D') {
      if (this.cursorPos > 0) {
        this.autocomplete.clearGhost();
        this.moveCursorTo(this.cursorPos - 1);
      }
      return;
    }

    // Right arrow: move one character right
    if (data === '\x1b[C') {
      if (this.cursorPos < this.inputBuffer.length) {
        this.autocomplete.clearGhost();
        this.moveCursorTo(this.cursorPos + 1);
        this.updateAutocomplete();
      }
      return;
    }

    // Up arrow: previous history entry
    if (data === '\x1b[A') {
      if (this.history.length === 0) return;
      if (this.historyIndex === -1) {
        this.savedInput = this.inputBuffer;
        this.historyIndex = this.history.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
      this.replaceInput(this.history[this.historyIndex]);
      return;
    }

    // Down arrow: next history entry or back to saved input
    if (data === '\x1b[B') {
      if (this.historyIndex === -1) return;
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.replaceInput(this.history[this.historyIndex]);
      } else {
        this.historyIndex = -1;
        this.replaceInput(this.savedInput);
      }
      return;
    }

    // Enter
    if (data === '\r') {
      this.autocomplete.clearGhost();
      const text = this.inputBuffer.trim();
      if (text) {
        // Suppress consecutive duplicate history entries
        if (this.history.length === 0 || this.history[this.history.length - 1] !== text) {
          this.history.push(text);
        }
        this.historyIndex = -1;
        this.savedInput = '';
        this.terminal.write('\r\n');
        this.options.onSubmit(text);
      }
      return;
    }

    // Tab: accept autocomplete suggestion
    if (data === '\t') {
      const ghost = this.autocomplete.getGhost();
      if (ghost) {
        this.autocomplete.clearGhost();
        this.inputBuffer += ghost;
        this.cursorPos = this.inputBuffer.length;
        this.terminal.write(ghost);
        this.updateAutocomplete();
      }
      return;
    }

    // Backspace
    if (data === '\x7f') {
      if (this.cursorPos > 0) {
        this.autocomplete.clearGhost();
        this.deleteBack(1);
        this.updateAutocomplete();
      }
      return;
    }

    // Ctrl+C: cancel input
    if (data === '\x03') {
      this.autocomplete.clearGhost();
      this.inputBuffer = '';
      this.cursorPos = 0;
      this.terminal.write('^C\r\n');
      this.showPrompt();
      return;
    }

    // Ctrl+U: kill (clear) current input line
    if (data === '\x15') {
      if (this.inputBuffer.length > 0) {
        this.replaceInput('');
      }
      return;
    }

    // Ctrl+W: delete previous word
    if (data === '\x17') {
      if (this.cursorPos > 0) {
        this.autocomplete.clearGhost();
        const boundary = this.wordBoundaryLeft(this.cursorPos);
        this.deleteBack(this.cursorPos - boundary);
        this.updateAutocomplete();
      }
      return;
    }

    // Ctrl+L: clear screen, redraw prompt and current input
    if (data === '\x0c') {
      this.autocomplete.clearGhost();
      this.terminal.clear();
      this.terminal.write('\x1b[2K\r');
      this.terminal.write(PROMPT + this.inputBuffer);
      // Reposition cursor if not at end
      const fromEnd = this.inputBuffer.length - this.cursorPos;
      if (fromEnd > 0) {
        this.terminal.write(`\x1b[${fromEnd}D`);
      }
      this.updateAutocomplete();
      return;
    }

    // Escape: dismiss autocomplete ghost or clear input
    if (data === '\x1b') {
      const ghost = this.autocomplete.getGhost();
      if (ghost) {
        this.autocomplete.clearGhost();
      } else if (this.inputBuffer.length > 0) {
        this.replaceInput('');
      }
      return;
    }

    // Ignore other control characters and unhandled escape sequences
    if (data.charCodeAt(0) < 32 || data.startsWith('\x1b')) {
      return;
    }

    // Regular character(s) - handles paste as well
    this.autocomplete.clearGhost();
    this.insertText(data);
    this.updateAutocomplete();
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
