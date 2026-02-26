// Markdown-to-HTML converter with requirement ID linkification
import { marked } from 'marked';

// Requirement ID pattern: REQ-XXX-NNN, GOAL-XXX, SC-XXX, etc.
const REQ_ID_PATTERN = /\b(REQ|GOAL|SC|BEH|IF|TC|TR|DD|PKG|AC|UXR)-[A-Z0-9]+-?[A-Z0-9]*/g;

// Configure marked for GFM
marked.setOptions({
  gfm: true,
  breaks: true,
});

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
