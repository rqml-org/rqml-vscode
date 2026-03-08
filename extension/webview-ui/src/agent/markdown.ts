// Markdown-to-HTML converter with requirement ID linkification
import { marked } from 'marked';

// Requirement ID pattern: REQ-XXX-NNN, GOAL-XXX, SC-XXX, etc.
const REQ_ID_PATTERN = /\b(REQ|GOAL|SC|BEH|IF|TC|TR|DD|PKG|AC|UXR)-[A-Z0-9]+-?[A-Z0-9]*/g;

// Configure marked for GFM
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Shell language identifiers
const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'console', 'terminal']);

// Common command prefixes for heuristic detection of unlabelled shell blocks
const CMD_PREFIXES = /^(\$\s?|>\s?)?(?:npm|npx|yarn|pnpm|bun|git|cd|mkdir|rm|cp|mv|ls|cat|echo|curl|wget|docker|cargo|make|pip|python|python3|node|deno|brew|apt|sudo|chmod|chown|touch|grep|find|sed|awk|tar|zip|unzip|ssh|scp)\b/;

/**
 * Heuristic: is this an unlabelled code block that looks like shell commands?
 * Every non-empty line must start with a known command prefix.
 */
function looksLikeShellBlock(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return false;
  return lines.every(l => CMD_PREFIXES.test(l.trim()));
}

/**
 * Heuristic: does this inline code text look like a single shell command?
 */
function looksLikeShellCommand(text: string): boolean {
  return CMD_PREFIXES.test(text.trim());
}

// SVG icons for code block buttons (small, inline)
const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/></svg>';
const RUN_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>';
const COPY_ICON_SM = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/></svg>';
const RUN_ICON_SM = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>';

// Custom renderer: intercept code fences
marked.use({
  renderer: {
    codespan({ text }: { text: string }) {
      // Inline code: if it looks like a shell command, add copy+run icons
      if (looksLikeShellCommand(text)) {
        const cmd = text.trim().replace(/^[\$>]\s?/, '');
        const encodedCmd = escapeHtml(cmd).replace(/"/g, '&quot;');
        return `<span class="inline-cmd"><code>${escapeHtml(text)}</code><button class="cmd-copy" data-cmd="${encodedCmd}" title="Copy">${COPY_ICON_SM}</button><button class="cmd-run" data-cmd="${encodedCmd}" title="Run in terminal">${RUN_ICON_SM}</button></span>`;
      }
      return `<code>${escapeHtml(text)}</code>`;
    },
    code({ text, lang }: { text: string; lang?: string }) {
      if (lang === 'mermaid') {
        const encoded = btoa(unescape(encodeURIComponent(text)));
        return `<div class="mermaid-placeholder" data-mermaid-source="${encoded}"><pre><code class="language-mermaid">${escapeHtml(text)}</code></pre></div>`;
      }

      const isShell = (lang && SHELL_LANGS.has(lang.toLowerCase())) || (!lang && looksLikeShellBlock(text));

      if (isShell) {
        // Shell block: per-line copy + run buttons
        const lines = text.split('\n');
        const lineHtml = lines.map(line => {
          const trimmed = line.trim();
          if (!trimmed) return `<div class="cmd-line cmd-line-empty"></div>`;
          // Strip leading $ or > prompt
          const cmd = trimmed.replace(/^[\$>]\s?/, '');
          const encodedCmd = escapeHtml(cmd).replace(/"/g, '&quot;');
          return `<div class="cmd-line"><span class="cmd-text">${escapeHtml(line)}</span><button class="cmd-copy" data-cmd="${encodedCmd}" title="Copy">${COPY_ICON}</button><button class="cmd-run" data-cmd="${encodedCmd}" title="Run in terminal">${RUN_ICON}</button></div>`;
        }).join('');
        return `<div class="code-block code-block-shell">${lineHtml}</div>`;
      }

      // Non-shell code block: single copy button
      const encoded = btoa(unescape(encodeURIComponent(text)));
      const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      return `<div class="code-block"><button class="code-copy" data-code="${encoded}" title="Copy">${COPY_ICON}</button><pre><code${langClass}>${escapeHtml(text)}</code></pre></div>`;
    },
  },
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert markdown text to HTML with requirement ID links.
 */
export function renderMarkdown(text: string): string {
  // First pass: render markdown to HTML
  const html = marked.parse(text, { async: false }) as string;

  // Second pass: linkify requirement IDs (but not inside existing <a> or <code> tags)
  return linkifyRequirementIds(html);
}

/**
 * Replace requirement ID patterns with clickable links,
 * avoiding replacements inside <a>, <code>, or <pre> tags.
 */
function linkifyRequirementIds(html: string): string {
  // Split on tags to avoid replacing inside code/link elements
  const parts = html.split(/(<[^>]+>)/);
  let insideCode = false;
  let insideLink = false;

  return parts.map(part => {
    // Track tag state
    if (part.startsWith('<')) {
      const lower = part.toLowerCase();
      if (lower.startsWith('<code') || lower.startsWith('<pre')) insideCode = true;
      if (lower.startsWith('</code') || lower.startsWith('</pre')) insideCode = false;
      if (lower.startsWith('<a ')) insideLink = true;
      if (lower.startsWith('</a')) insideLink = false;
      return part;
    }

    // Don't linkify inside code or existing links
    if (insideCode || insideLink) return part;

    return part.replace(REQ_ID_PATTERN, (match) =>
      `<a class="req-link" data-req-id="${match}">${match}</a>`
    );
  }).join('');
}
