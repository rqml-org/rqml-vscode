// Tool definitions for the /implement slash command.
// Uses Vercel AI SDK tool() + zod for multi-step agentic implementation.

import { tool } from 'ai';
import { z } from 'zod';
import * as vscode from 'vscode';
import * as nodePath from 'path';
import type { AgentService } from './agentService';
import { getSpecService } from './specService';
import { getConfigurationService } from './configurationService';
import { computeLineDiff } from './diffUtil';
import { loadCore } from './core';
import { writeSpecGuarded } from './specWrite';
import { log } from './logger';
import {
  blockedWrite,
  isSpecModeAllowedWritePath,
  resolveWorkspacePath,
} from './gate/writeGate';

// REQ-AGT-030 and REQ-GATE-005 both decide whether a write may proceed. Their
// logic lives in gate/writeGate.ts, which imports no vscode API so the path
// handling — where the defect was — is unit-testable.

/**
 * Create the tool set for the /implement agentic loop.
 * Read tools execute immediately; write tools require user approval.
 */
export function createImplementTools(
  workspaceRoot: string,
  agentService: AgentService
) {
  return {
    readFile: tool({
      description:
        'Read the contents of a file in the workspace. Use this to understand existing code before making changes. ' +
        'Accepts a path relative to the workspace root, or the absolute path of a skill file listed in the prompt.',
      inputSchema: z.object({
        path: z
          .string()
          .describe('Relative path from workspace root (e.g. "src/index.ts"), or an absolute skill path'),
      }),
      execute: async ({ path: requested }) => {
        // `Uri.joinPath` joins rather than resolves, so an absolute path was
        // being appended to the workspace root — producing
        // "<workspace>/Users/…/SKILL.md", which cannot exist. Skills are
        // advertised to the agent by absolute path, so every skill the prompt
        // named was unreadable. Reading is a safe operation, so an absolute
        // path is allowed here; writes stay confined to the workspace.
        const uri = nodePath.isAbsolute(requested)
          ? vscode.Uri.file(requested)
          : vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), requested);
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          return Buffer.from(bytes).toString('utf-8');
        } catch {
          return `Error: file "${requested}" not found or unreadable.`;
        }
      },
    }),

    writeFile: tool({
      description:
        'Write content to a file in the workspace (creates or overwrites). Requires user approval before execution.',
      inputSchema: z.object({
        path: z.string().describe('Relative path from workspace root'),
        content: z.string().describe('Full file content to write'),
      }),
      execute: async ({ path, content }) => {
        // Resolve before deciding anything. Every check below is about where the
        // write lands, and the raw tool input does not tell you that: a path may
        // begin ".rqml/adr/" and still resolve to project source, or out of the
        // workspace entirely.
        const relativePath = resolveWorkspacePath(workspaceRoot, path);
        if (relativePath === undefined) {
          log.info('Gate', `refused a write outside the workspace: ${path}`);
          return (
            `Refused to write "${path}": it resolves outside the workspace. ` +
            `Provide a path relative to the workspace root.`
          );
        }

        // REQ-AGT-030: Spec mode maintains design and planning artifacts, not
        // project source.
        if (
          getConfigurationService().getAgentMode() === 'spec' &&
          !isSpecModeAllowedWritePath(relativePath)
        ) {
          return (
            `writeFile to "${relativePath}" is unavailable in Spec mode. ` +
            `Switch to Build mode for direct edits, or use /cmd to generate an implementation prompt for an external coding agent. ` +
            `In Spec mode you may still write ADRs under .rqml/adr/ and the plan file .rqml/plan.md.`
          );
        }

        // REQ-GATE-005: approval before implementation. Off by default — it
        // changes the behaviour of a tool people already rely on — and it
        // governs this agent's writes only. See ADR-0006 for why nothing else
        // can be blocked from here.
        if (vscode.workspace.getConfiguration('rqml').get<boolean>('gate.blockAgentEdits', false)) {
          const specState = getSpecService().state;
          const specUri = specState.activeSpecUri;
          if (specUri) {
            try {
              const core = await loadCore();
              const xml = Buffer.from(await vscode.workspace.fs.readFile(specUri)).toString('utf8');
              const parsed = core.parse(xml);
              if (parsed.ok) {
                const blocked = blockedWrite(core.approvalGate, parsed.document, relativePath);
                if (blocked) {
                  log.info('Gate', `refused a write to ${relativePath}`, {
                    requirement: blocked.requirementId,
                    edge: blocked.edgeId,
                  });
                  return blocked.reason;
                }
              }
            } catch (err) {
              // A gate that cannot run must not silently become permission.
              // Say so, and let the write proceed to its normal approval prompt
              // rather than failing the task outright.
              log.error('Gate', 'approval check could not run; write not gated', err);
            }
          }
        }

        const approvalId = crypto.randomUUID();

        // Read existing file content so we can show a side-by-side diff
        const uri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), path);
        let existingContent = '';
        let isNewFile = false;
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          existingContent = Buffer.from(bytes).toString('utf-8');
        } catch {
          isNewFile = true;
        }

        const diffRows = computeLineDiff(existingContent, content);

        const approved = await agentService.waitForToolApproval(approvalId, 'writeFile', {
          path,
          preview: content.length > 2000 ? content.slice(0, 2000) + '\n...(truncated)' : content,
          diffRows,
          isNewFile,
        });

        if (!approved) {
          return `Write to "${path}" was rejected by the user.`;
        }

        try {
          // Ensure parent directory exists
          const parentUri = vscode.Uri.joinPath(uri, '..');
          try {
            await vscode.workspace.fs.stat(parentUri);
          } catch {
            await vscode.workspace.fs.createDirectory(parentUri);
          }
          await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
          return `File written successfully: ${path}`;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return `Error writing "${path}": ${message}`;
        }
      },
    }),

    listFiles: tool({
      description:
        'List files in the workspace matching a glob pattern. Returns relative paths.',
      inputSchema: z.object({
        pattern: z
          .string()
          .describe('Glob pattern to match (e.g. "src/**/*.ts", "**/*.rqml")'),
        maxResults: z
          .number()
          .optional()
          .describe('Maximum number of results to return (default 50)'),
      }),
      execute: async ({ pattern, maxResults }) => {
        try {
          const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', maxResults ?? 50);
          const rootUri = vscode.Uri.file(workspaceRoot);
          const paths = files.map((f) => {
            const rel = f.path.slice(rootUri.path.length + 1);
            return rel;
          });
          if (paths.length === 0) {return 'No files found matching the pattern.';}
          return paths.join('\n');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return `Error listing files: ${message}`;
        }
      },
    }),

    readSpec: tool({
      description:
        'Read the current RQML specification file content. Use this to understand requirements, trace edges, and statuses.',
      inputSchema: z.object({}),
      execute: async () => {
        const specService = getSpecService();
        const state = specService.state;
        if (!state.document?.uri) {return 'No RQML spec file is currently loaded.';}
        try {
          const bytes = await vscode.workspace.fs.readFile(state.document.uri);
          return Buffer.from(bytes).toString('utf-8');
        } catch {
          return 'Error reading the RQML spec file.';
        }
      },
    }),

    askUser: tool({
      description:
        'Ask the user a question and present options to choose from. ' +
        'ALWAYS use this tool instead of asking questions in plain text. ' +
        'The user will see a card with clickable options. ' +
        'Put your recommended option first and set recommended to 0.',
      inputSchema: z.object({
        question: z.string().describe('The question to ask the user'),
        options: z.array(z.string()).min(2).max(6).describe('2-6 options for the user to choose from'),
        recommended: z.number().int().min(0).optional().describe('0-based index of the recommended option (highlighted and pre-selected)'),
      }),
      execute: async ({ question, options, recommended }) => {
        const choiceId = crypto.randomUUID();
        const selected = await agentService.waitForUserChoice(choiceId, question, options, recommended);
        return `User selected: ${selected}`;
      },
    }),

    updateSpec: tool({
      description:
        'Update the RQML specification file with new content. Use this after implementing code to add trace edges, update requirement statuses, etc. Requires user approval.',
      inputSchema: z.object({
        content: z.string().describe('Full updated RQML file content'),
        description: z
          .string()
          .describe('Brief description of what changed (e.g. "Added trace edges for REQ-AUTH-001")'),
      }),
      execute: async ({ content, description }) => {
        const approvalId = crypto.randomUUID();
        const approved = await agentService.waitForToolApproval(approvalId, 'updateSpec', {
          description,
          preview: content.length > 2000 ? content.slice(0, 2000) + '\n...(truncated)' : content,
        });

        if (!approved) {
          return 'Spec update was rejected by the user.';
        }

        const specService = getSpecService();
        const state = specService.state;
        if (!state.document?.uri) {return 'No RQML spec file is currently loaded.';}

        try {
          // Never write model output to the specification unchecked. This tool
          // replaces the entire document, so an unparseable or truncated result
          // would destroy it: the write does not enter VS Code's undo stack and
          // no backup is taken.
          const result = await writeSpecGuarded(state.document.uri, content, 'updateSpec');
          if (!result.ok) {return result.reason;}
          return result.remaining.length > 0
            ? `Spec updated: ${description}. Note the document still has ` +
              `${result.remaining.length} pre-existing error(s).`
            : `Spec updated: ${description}`;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return `Error updating spec: ${message}`;
        }
      },
    }),
  };
}
