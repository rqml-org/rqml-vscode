// REQ-GATE-003 AC-GATE-003-02: anchor a finding to the element it concerns.
//
// Validation diagnostics carry a line from libxml2. Coverage and drift findings
// do not — they are computed from the parsed model, which has no source
// positions. Reported naively they all land on line 1, so the Problems panel
// shows a stack of entries pointing at the XML declaration, and a user cannot
// navigate to what is actually wrong.
//
// Resolving an id to its declaration is a text search rather than a parse: the
// engine does not expose positions, and re-parsing to obtain them would double
// the work for a result the user only needs when a finding exists.
//
// Kept free of any `vscode` import so it can be unit-tested without an
// extension host.

/** 1-based line, matching the engine's convention. */
export type Line = number;

/**
 * Find the 1-based line where `id` is declared, or undefined if it is not found.
 *
 * Matches `id="<id>"` with the exact id, so REQ-UI-001 does not match
 * REQ-UI-0011. Attribute order varies across elements, so this deliberately
 * searches for the attribute rather than for a particular element shape.
 */
export function findDeclarationLine(xml: string, id: string): Line | undefined {
  if (!id) return undefined;
  const pattern = new RegExp(`\\bid\\s*=\\s*"${escapeRegExp(id)}"`);
  const lines = xml.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i + 1;
  }
  return undefined;
}

/**
 * Pick the best line for a diagnostic that may already carry one.
 *
 * An engine-supplied line always wins — it is precise. Otherwise try each
 * candidate id in order, most specific first, and fall back to line 1 only when
 * nothing resolves.
 */
export function anchorLine(
  xml: string,
  engineLine: number | undefined,
  candidateIds: readonly (string | undefined)[]
): Line {
  if (engineLine !== undefined && engineLine > 0) return engineLine;
  for (const id of candidateIds) {
    if (!id) continue;
    const line = findDeclarationLine(xml, id);
    if (line !== undefined) return line;
  }
  return 1;
}

/**
 * Ids mentioned in a diagnostic message, most specific first.
 *
 * The engine's messages name the artifacts they concern in quotes — a trace
 * edge id, a requirement id — so pulling them out gives an anchor without the
 * engine having to grow a positions API. This is a best-effort heuristic: when
 * it finds nothing, anchoring falls back to line 1, which is no worse than
 * where every finding landed before.
 */
export function idsInMessage(message: string): string[] {
  const ids: string[] = [];
  // Quoted identifiers: `Trace edge "E-1" (to) references unknown id "REQ-X".`
  for (const match of message.matchAll(/"([A-Za-z][A-Za-z0-9._-]{1,79})"/g)) {
    ids.push(match[1]);
  }
  // Bare ids in the engine's coverage phrasing, which does not always quote.
  for (const match of message.matchAll(/\b((?:REQ|GOAL|QGOAL|E|TR|AC|PKG)-[A-Za-z0-9._-]+)\b/g)) {
    if (!ids.includes(match[1])) ids.push(match[1]);
  }
  return ids;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
