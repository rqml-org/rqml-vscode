// REQ-CMD-002: Fish-shell-style ghost-text autocomplete for slash commands

import type { Terminal } from '@xterm/xterm';

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * Autocomplete — renders ghost text suggestions in the terminal.
 * When input starts with `/` and has no spaces, shows the first matching
 * command suffix in dim text. Tab accepts the suggestion.
 */
export class Autocomplete {
  private commandNames: string[] = [];
  private currentGhost = '';

  constructor(private terminal: Terminal) {}

  /** Set the available command names (called once on init, or when list changes) */
  setCommandNames(names: string[]): void {
    this.commandNames = names;
  }

  /**
   * Update ghost text based on current input buffer.
   * Call this after every keystroke in idle mode.
   * Returns the ghost suffix currently being displayed (for Tab acceptance).
   */
  update(inputBuffer: string): string {
    // Clear any previous ghost text
    this.clearGhost();

    // Only suggest when input is a partial slash command with no spaces
    if (!inputBuffer.startsWith('/') || inputBuffer.includes(' ')) {
      return '';
    }

    const partial = inputBuffer.slice(1).toLowerCase();
    if (partial.length === 0) return '';

    // Find first matching command
    const match = this.commandNames.find(name => name.startsWith(partial) && name !== partial);
    if (!match) return '';

    const suffix = match.slice(partial.length);
    this.currentGhost = suffix;

    // Write ghost text (dim) then move cursor back
    this.terminal.write(`${DIM}${suffix}${RESET}`);
    // Move cursor back to the real input position
    this.terminal.write(`\x1b[${suffix.length}D`);

    return suffix;
  }

  /** Clear ghost text from the terminal */
  clearGhost(): void {
    if (this.currentGhost.length > 0) {
      // Save cursor, erase from cursor to end of line, restore cursor
      this.terminal.write('\x1b[s\x1b[K\x1b[u');
      this.currentGhost = '';
    }
  }

  /** Get the current ghost suffix (for Tab acceptance) */
  getGhost(): string {
    return this.currentGhost;
  }
}
