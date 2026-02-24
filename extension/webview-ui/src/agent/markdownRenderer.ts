import type { Terminal } from '@xterm/xterm';

// ANSI escape sequences
const BOLD = '\x1b[1m';
const BOLD_OFF = '\x1b[22m';
const ITALIC = '\x1b[3m';
const ITALIC_OFF = '\x1b[23m';
const UNDERLINE = '\x1b[4m';
const UNDERLINE_OFF = '\x1b[24m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const FG_DEFAULT = '\x1b[39m';
const RESET = '\x1b[0m';

/**
 * Convert inline markdown to ANSI escape sequences.
 * Processes: inline code, bold, italic, links.
 * Code spans are extracted first to protect their contents.
 */
export function renderInline(text: string): string {
  // Step 1: Extract inline code spans into placeholders
  const codeSegments: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    codeSegments.push(code);
    return `\x00CODE${codeSegments.length - 1}\x00`;
  });

  // Step 2: Bold (must come before italic to handle ** vs *)
  text = text.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${BOLD_OFF}`);
  text = text.replace(/__(.+?)__/g, `${BOLD}$1${BOLD_OFF}`);

  // Step 3: Italic
  text = text.replace(/\*(.+?)\*/g, `${ITALIC}$1${ITALIC_OFF}`);
  text = text.replace(/(?<!\w)_(.+?)_(?!\w)/g, `${ITALIC}$1${ITALIC_OFF}`);

  // Step 4: Links [text](url) -> underlined text
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `${UNDERLINE}$1${UNDERLINE_OFF}`);

  // Step 5: Restore code placeholders as cyan
  text = text.replace(/\x00CODE(\d+)\x00/g, (_, idx) => {
    return `${CYAN}${codeSegments[parseInt(idx)]}${FG_DEFAULT}`;
  });

  return text;
}

/**
 * Line-buffered markdown-to-ANSI renderer for xterm.js.
 *
 * During streaming: completed lines are formatted, the current
 * incomplete line is written raw and erased/rewritten as it grows.
 * On stream end: the final line is formatted and committed.
 */
export class MarkdownRenderer {
  private terminal: Terminal;
  private committedLines = 0;
  private lastIncompleteText = '';
  private lastIncompleteRows = 0;
  private inCodeBlock = false;
  private codeBlockFence = '';

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  /** Called on each agentStreaming message with the full accumulated text. */
  update(fullContent: string): void {
    const parts = fullContent.split('\n');
    const completeLineCount = parts.length - 1;
    const incompleteText = parts[parts.length - 1];

    if (completeLineCount > this.committedLines) {
      // New complete lines arrived
      this.eraseIncompleteLine();

      for (let i = this.committedLines; i < completeLineCount; i++) {
        this.terminal.writeln(this.formatLine(parts[i]));
      }
      this.committedLines = completeLineCount;

      this.writeIncompleteLine(incompleteText);
    } else if (incompleteText !== this.lastIncompleteText) {
      // Same complete lines, incomplete line grew
      this.eraseIncompleteLine();
      this.writeIncompleteLine(incompleteText);
    }
  }

  /** Called on agentStreamEnd with the final complete text. */
  finish(fullContent: string): void {
    const parts = fullContent.split('\n');
    const completeLineCount = parts.length - 1;
    const lastPart = parts[parts.length - 1];

    this.eraseIncompleteLine();

    for (let i = this.committedLines; i < completeLineCount; i++) {
      this.terminal.writeln(this.formatLine(parts[i]));
    }

    if (lastPart.length > 0) {
      this.terminal.writeln(this.formatLine(lastPart));
    }

    // Reset state
    this.committedLines = 0;
    this.lastIncompleteText = '';
    this.lastIncompleteRows = 0;
    this.inCodeBlock = false;
    this.codeBlockFence = '';
  }

  /** Format a single complete markdown line into ANSI. */
  private formatLine(line: string): string {
    // 1. Code fence toggle
    const fenceMatch = line.match(/^(\s*)(```|~~~)(.*)/);
    if (fenceMatch) {
      if (this.inCodeBlock && line.trimStart().startsWith(this.codeBlockFence)) {
        this.inCodeBlock = false;
        this.codeBlockFence = '';
        return `${DIM}${CYAN}${fenceMatch[2]}${RESET}`;
      } else if (!this.inCodeBlock) {
        this.inCodeBlock = true;
        this.codeBlockFence = fenceMatch[2];
        const lang = fenceMatch[3].trim();
        return `${DIM}${CYAN}${fenceMatch[2]}${lang ? ' ' + lang : ''}${RESET}`;
      }
    }

    // 2. Inside code block - cyan, no further formatting
    if (this.inCodeBlock) {
      return `${CYAN}${line}${FG_DEFAULT}`;
    }

    // 3. Empty line
    if (line.length === 0) {
      return '';
    }

    // 4. Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      return `${BOLD}${BLUE}${renderInline(headerMatch[2])}${RESET}`;
    }

    // 5. Horizontal rule
    if (/^(\s*)([-*_])\s*\2\s*\2[\s\-*_]*$/.test(line)) {
      return `${DIM}${'─'.repeat(40)}${RESET}`;
    }

    // 6. Task list (must be before unordered list)
    const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)/);
    if (taskMatch) {
      const indent = taskMatch[1];
      const checked = taskMatch[2].toLowerCase() === 'x';
      const text = renderInline(taskMatch[3]);
      const box = checked ? `${GREEN}[x]${FG_DEFAULT}` : '[ ]';
      return `${indent}${box} ${text}${RESET}`;
    }

    // 7. Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
    if (ulMatch) {
      const indent = ulMatch[1];
      const text = renderInline(ulMatch[2]);
      return `${indent}${DIM}\u2022${BOLD_OFF} ${text}${RESET}`;
    }

    // 8. Ordered list
    const olMatch = line.match(/^(\s*)(\d+)[.)]\s+(.*)/);
    if (olMatch) {
      const indent = olMatch[1];
      const num = olMatch[2];
      const text = renderInline(olMatch[3]);
      return `${indent}${DIM}${num}.${BOLD_OFF} ${text}${RESET}`;
    }

    // 9. Blockquote
    const bqMatch = line.match(/^(\s*)>\s?(.*)/);
    if (bqMatch) {
      const text = renderInline(bqMatch[2]);
      return `${DIM}\u2502${RESET} ${ITALIC}${text}${ITALIC_OFF}`;
    }

    // 10. Default paragraph
    return renderInline(line);
  }

  /** Erase the raw incomplete line currently displayed in the terminal. */
  private eraseIncompleteLine(): void {
    if (this.lastIncompleteText.length === 0) {
      return;
    }
    const rowsToGoUp = this.lastIncompleteRows - 1;
    if (rowsToGoUp > 0) {
      this.terminal.write(`\x1b[${rowsToGoUp}A`);
    }
    this.terminal.write('\r\x1b[J');
    this.lastIncompleteText = '';
    this.lastIncompleteRows = 0;
  }

  /** Write raw text for the incomplete line (no trailing newline). */
  private writeIncompleteLine(text: string): void {
    if (text.length === 0) {
      this.lastIncompleteText = '';
      this.lastIncompleteRows = 0;
      return;
    }
    this.terminal.write(text);
    this.lastIncompleteText = text;
    const cols = this.terminal.cols || 80;
    this.lastIncompleteRows = Math.max(1, Math.ceil(text.length / cols));
  }
}