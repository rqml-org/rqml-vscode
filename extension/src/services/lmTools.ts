// Language model tools contributed to the user's own coding agent.
//
// Deliberately few. `@rqml/mcp` already exposes the whole engine — rqml_check,
// rqml_show, rqml_link, rqml_impact and nine more — and the extension registers
// it (see mcpProvider.ts). Contributing the same operations again would give
// the agent two ways to ask one question, and every extension tool invocation
// costs the user a confirmation dialog that cannot be suppressed.
//
// So the bar for a tool here is: it must be impossible from the MCP server,
// because it needs an editor handle or editor-only state. Two qualify.
//
// Neither tool can block anything. ADR-0006 records that no VS Code extension
// API can veto an edit, and the Language Model Tools API does not change that:
// the whole interface is `invoke` and `prepareInvocation`, with no hook that
// fires before another tool runs. These inform an agent; they do not police it.

import * as vscode from 'vscode';
import * as path from 'path';
import { log } from './logger';
import { getSpecService } from './specService';
import { getGateService } from './gateService';
import { evaluate, summarise } from './gate/verdict';
import { resolveStrictness } from './strictnessService';

/** Tool names, matching `contributes.languageModelTools[].name` in package.json. */
export const TOOL_SPEC_CONTEXT = 'rqml_editor_context';
export const TOOL_CHECK_BUFFER = 'rqml_check_unsaved';

const text = (value: string) => new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(value)]);

/**
 * Which specification governs what the user is looking at.
 *
 * The MCP server runs in its own process with a fixed working directory. It has
 * no idea which file is open, where the cursor is, or — in a monorepo — which
 * unit the user has moved to. An agent that knows this stops asking.
 */
class EditorContextTool implements vscode.LanguageModelTool<Record<string, never>> {
  async invoke(): Promise<vscode.LanguageModelToolResult> {
    const state = getSpecService().state;
    const editor = vscode.window.activeTextEditor;
    const lines: string[] = [];

    if (state.activeSpecUri) {
      const specPath = state.activeSpecUri.fsPath;
      lines.push(`Governing specification: ${specPath}`);
      lines.push(`Unit root (the MCP server's working directory): ${path.dirname(specPath)}`);
      if (state.document) {
        lines.push(`Document ${state.document.docId}, schema ${state.document.version}, status ${state.document.status}`);
      }
      lines.push(`Strictness: ${await resolveStrictness()}`);
    } else {
      lines.push('No RQML specification governs this workspace.');
    }

    if (state.files.length > 1) {
      lines.push(
        `${state.files.length} specifications in this workspace; the active one governs the file below.`
      );
    }
    if (state.ambiguous?.length) {
      lines.push(
        `${state.ambiguous.length} directory(ies) hold several .rqml files with no requirements.rqml, so no single specification governs them.`
      );
    }

    if (editor) {
      lines.push('', `Active file: ${editor.document.uri.fsPath}`);
      const line = editor.selection.active.line + 1;
      lines.push(`Cursor at line ${line}${editor.document.isDirty ? ' (file has unsaved changes)' : ''}`);
    } else {
      lines.push('', 'No file is open in the editor.');
    }

    const verdict = getGateService().verdict;
    if (verdict) {
      lines.push('', `Last gate verdict: ${summarise(verdict)} — ${verdict.diagnostics.length} finding(s).`);
    }

    return text(lines.join('\n'));
  }

  prepareInvocation(): vscode.PreparedToolInvocation {
    return { invocationMessage: 'Reading the RQML editor context' };
  }
}

/**
 * Run the gate against the UNSAVED buffer.
 *
 * The one gate operation MCP genuinely cannot perform: `rqml_check` reads the
 * specification from disk, so while an agent is editing it, that answer is
 * about a file that no longer reflects the work. This evaluates what is in the
 * editor right now, using the same composition as `rqml check`.
 */
class CheckUnsavedTool implements vscode.LanguageModelTool<Record<string, never>> {
  async invoke(): Promise<vscode.LanguageModelToolResult> {
    const uri = getSpecService().state.activeSpecUri;
    if (!uri) {return text('No RQML specification governs this workspace.');}

    const open = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === uri.fsPath);
    if (!open) {
      return text(
        'The specification is not open in an editor, so there are no unsaved changes to check. ' +
        'Use the MCP tool rqml_check for the version on disk.'
      );
    }
    if (!open.isDirty) {
      return text(
        'The specification has no unsaved changes; the version on disk is current. ' +
        'Use the MCP tool rqml_check for its verdict.'
      );
    }

    const strictness = await resolveStrictness();
    const verdict = await evaluate(open.getText(), {
      baseDir: path.dirname(uri.fsPath),
      strictness,
    });

    const lines = [
      `${summarise(verdict)} — evaluated against the UNSAVED buffer, not the file on disk.`,
    ];
    if (verdict.diagnostics.length > 0) {
      lines.push('', ...verdict.diagnostics.slice(0, 20).map((d) => `  - ${d.message}`));
      if (verdict.diagnostics.length > 20) {
        lines.push(`  - …and ${verdict.diagnostics.length - 20} more`);
      }
    }
    return text(lines.join('\n'));
  }

  prepareInvocation(): vscode.PreparedToolInvocation {
    return { invocationMessage: 'Running the RQML gate on unsaved changes' };
  }
}

export function registerLanguageModelTools(context: vscode.ExtensionContext): void {
  if (typeof vscode.lm?.registerTool !== 'function') {
    log.info('Tools', 'this VS Code build cannot register language model tools; skipping');
    return;
  }

  context.subscriptions.push(
    vscode.lm.registerTool(TOOL_SPEC_CONTEXT, new EditorContextTool()),
    vscode.lm.registerTool(TOOL_CHECK_BUFFER, new CheckUnsavedTool())
  );
  log.info('Tools', `registered ${TOOL_SPEC_CONTEXT} and ${TOOL_CHECK_BUFFER}`);
}
