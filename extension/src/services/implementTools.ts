// Tool definitions for the /implement slash command.
// Uses Vercel AI SDK tool() + zod for multi-step agentic implementation.

import { tool } from 'ai';
import { z } from 'zod';
import * as vscode from 'vscode';
import type { AgentService } from './agentService';
import { getSpecService } from './specService';

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
        'Read the contents of a file in the workspace. Use this to understand existing code before making changes.',
      inputSchema: z.object({
        path: z.string().describe('Relative path from workspace root (e.g. "src/index.ts")'),
      }),
      execute: async ({ path }) => {
        agentService.fireMessage({
          type: 'systemMessage',
          payload: { content: `Reading \`${path}\`...` },
        });
        try {
          const uri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), path);
          const bytes = await vscode.workspace.fs.readFile(uri);
          return Buffer.from(bytes).toString('utf-8');
        } catch {
          return `Error: file "${path}" not found or unreadable.`;
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
        const approvalId = crypto.randomUUID();
        const approved = await agentService.waitForToolApproval(approvalId, 'writeFile', {
          path,
          preview: content.length > 2000 ? content.slice(0, 2000) + '\n...(truncated)' : content,
        });

        if (!approved) {
          return `Write to "${path}" was rejected by the user.`;
        }

        try {
          const uri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), path);
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
        agentService.fireMessage({
          type: 'systemMessage',
          payload: { content: `Listing files matching \`${pattern}\`...` },
        });
        try {
          const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', maxResults ?? 50);
          const rootUri = vscode.Uri.file(workspaceRoot);
          const paths = files.map((f) => {
            const rel = f.path.slice(rootUri.path.length + 1);
            return rel;
          });
          if (paths.length === 0) return 'No files found matching the pattern.';
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
        agentService.fireMessage({
          type: 'systemMessage',
          payload: { content: 'Reading RQML spec...' },
        });
        const specService = getSpecService();
        const state = specService.state;
        if (!state.document?.uri) return 'No RQML spec file is currently loaded.';
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
        'The user will see a card with clickable options.',
      inputSchema: z.object({
        question: z.string().describe('The question to ask the user'),
        options: z.array(z.string()).min(2).max(6).describe('2-6 options for the user to choose from'),
      }),
      execute: async ({ question, options }) => {
        const choiceId = crypto.randomUUID();
        const selected = await agentService.waitForUserChoice(choiceId, question, options);
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
        if (!state.document?.uri) return 'No RQML spec file is currently loaded.';

        try {
          await vscode.workspace.fs.writeFile(state.document.uri, Buffer.from(content, 'utf-8'));
          return `Spec updated: ${description}`;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return `Error updating spec: ${message}`;
        }
      },
    }),
  };
}
