// Targeted text edits to the specification document.
//
// These are text operations rather than parse → modify → serialize, and that is
// deliberate. `serialize()` preserves the MODEL but not the TEXT: round-tripping
// this repository's own specification reflows the file and deletes all nine of
// its XML comments. A tree-view rename must not silently strip a user's
// commentary, so every edit here changes only the span it targets and leaves
// the rest of the file byte-identical.
//
// Text editing XML is fragile, which is why nothing produced here reaches disk
// unchecked: every caller writes through writeSpecGuarded, which re-parses,
// re-validates and runs integrity, and refuses anything that introduces an
// error. A malformed edit is therefore a refused write, not a corrupted file.
//
// Kept free of any `vscode` import so each operation can be unit-tested.

export type TextEditResult =
  | { ok: true; xml: string }
  | { ok: false; error: string };

/** Escape a value for use inside a regular expression. */
function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Locate the opening tag of the element declaring `id`.
 *
 * Returns the tag's start and end offsets and its element name. Matches the
 * attribute rather than a particular element shape, because id-bearing elements
 * vary (req, goal, edge, testCase, …) and attribute order is not fixed.
 */
export function findOpeningTag(
  xml: string,
  id: string
): { start: number; end: number; name: string; selfClosing: boolean } | undefined {
  const pattern = new RegExp(`<([A-Za-z][\\w.-]*)\\b[^>]*?\\bid\\s*=\\s*"${escape(id)}"[^>]*?>`, 'g');
  const match = pattern.exec(xml);
  if (!match) {return undefined;}
  return {
    start: match.index,
    end: match.index + match[0].length,
    name: match[1],
    selfClosing: match[0].endsWith('/>'),
  };
}

/**
 * The full extent of the element declaring `id`, including nested children.
 *
 * Scans for balanced open/close tags of the same element name rather than
 * matching lazily to the first closing tag, because RQML nests same-named
 * elements — a `<req>` inside a `<reqPackage>`, a `<state>` inside a
 * `<stateMachine>` — and a lazy match would cut the block short.
 */
export function findElementRange(
  xml: string,
  id: string
): { start: number; end: number; name: string } | undefined {
  const open = findOpeningTag(xml, id);
  if (!open) {return undefined;}
  if (open.selfClosing) {return { start: open.start, end: open.end, name: open.name };}

  const openTag = new RegExp(`<${escape(open.name)}\\b(?:"[^"]*"|'[^']*'|[^>"'])*?>`, 'g');
  const closeTag = new RegExp(`</${escape(open.name)}\\s*>`, 'g');

  let depth = 1;
  let cursor = open.end;

  while (depth > 0) {
    openTag.lastIndex = cursor;
    closeTag.lastIndex = cursor;
    const nextOpen = openTag.exec(xml);
    const nextClose = closeTag.exec(xml);

    if (!nextClose) {return undefined; /* unbalanced; leave the document alone */}

    if (nextOpen && nextOpen.index < nextClose.index) {
      if (!nextOpen[0].endsWith('/>')) {depth++;}
      cursor = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      cursor = nextClose.index + nextClose[0].length;
      if (depth === 0) {return { start: open.start, end: cursor, name: open.name };}
    }
  }
  return undefined;
}

/** Change the `title` attribute of the element declaring `id`. */
export function renameElement(xml: string, id: string, title: string): TextEditResult {
  const open = findOpeningTag(xml, id);
  if (!open) {return { ok: false, error: `No element with id "${id}" was found.` };}

  const tag = xml.slice(open.start, open.end);
  const escaped = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  const hasTitle = /\btitle\s*=\s*"/.test(tag);
  const updated = hasTitle
    ? tag.replace(/\btitle\s*=\s*"(?:[^"\\]|\\.)*"/, `title="${escaped}"`)
    : // No title yet: place it after the id so attribute order stays readable.
      tag.replace(new RegExp(`(\\bid\\s*=\\s*"${escape(id)}")`), `$1 title="${escaped}"`);

  if (updated === tag) {return { ok: false, error: `Could not set a title on "${id}".` };}
  return { ok: true, xml: xml.slice(0, open.start) + updated + xml.slice(open.end) };
}

/** Remove the element declaring `id`, and the blank line it leaves behind. */
export function deleteElement(xml: string, id: string): TextEditResult {
  const range = findElementRange(xml, id);
  if (!range) {
    return {
      ok: false,
      error: `No element with id "${id}" was found, or its tags are unbalanced.`,
    };
  }

  // Take the indentation preceding the element and the newline following it, so
  // deleting does not leave a ragged blank line behind.
  let start = range.start;
  while (start > 0 && (xml[start - 1] === ' ' || xml[start - 1] === '\t')) {start--;}
  let end = range.end;
  if (xml[end] === '\r') {end++;}
  if (xml[end] === '\n') {end++;}

  return { ok: true, xml: xml.slice(0, start) + xml.slice(end) };
}

/**
 * Insert `snippet` as the last child of `containerTag`.
 *
 * Used with `skeleton()`, which returns a bare snippet and leaves placement to
 * the caller — core has no function that splices an element into a document.
 */
export function insertIntoSection(
  xml: string,
  containerTag: string,
  snippet: string
): TextEditResult {
  const close = new RegExp(`\\n([ \\t]*)</${escape(containerTag)}\\s*>`);
  const match = close.exec(xml);
  if (!match) {
    return { ok: false, error: `The document has no <${containerTag}> section to insert into.` };
  }

  // Indent the snippet one level in from the closing tag.
  const indent = `${match[1]}  `;
  const body = snippet
    .trimEnd()
    .split('\n')
    .map((line) => (line.trim() ? indent + line : line))
    .join('\n');

  const at = match.index;
  return { ok: true, xml: `${xml.slice(0, at)}\n${body}${xml.slice(at)}` };
}
