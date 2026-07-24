// Register the RQML MCP server for the user's own coding agent.
//
// ADR-0005 froze this extension's bespoke agent because it competes with tools
// the user already has. The corollary is this file: rather than building a
// better agent, hand the RQML toolchain to whichever agent they actually use.
// `@rqml/mcp` already exposes the whole engine — rqml_check, rqml_show,
// rqml_link, rqml_impact and nine more — so registering it is a small amount of
// code for the entire loop.
//
// The API used here (`lm.registerMcpServerDefinitionProvider`,
// `McpStdioServerDefinition`) is STABLE, finalized in VS Code 1.101 and present
// in the types this extension already compiles against. No engine floor change
// is needed.
//
// One caution for anyone extending this: the official MCP extension guide shows
// an object-literal constructor. That is wrong — the real signature is
// positional, and `cwd` is a settable property rather than a constructor
// parameter. Both are verified against @types/vscode.

import * as vscode from 'vscode';
import * as path from 'path';
import { log } from './logger';
import { getSpecService } from './specService';

/** Must match `contributes.mcpServerDefinitionProviders[].id` in package.json. */
export const MCP_PROVIDER_ID = 'rqml';

const SERVER_LABEL = 'RQML';

/**
 * The `@rqml/mcp` version the extension registers.
 *
 * Pinned rather than floating. ADR-0008 keeps the editor's engine and its
 * verdict in lockstep by depending on `@rqml/core` directly; an MCP server on a
 * different engine version could answer a question differently from the status
 * bar, which is the disagreement ADR-0006 forbids. Pinning makes that skew a
 * deliberate upgrade rather than something that happens overnight.
 *
 * Keep this in step with the `@rqml/core` version in package.json.
 */
export const MCP_SERVER_SPEC = '@rqml/mcp@0.7.1';

export class RqmlMcpProvider implements vscode.McpServerDefinitionProvider<vscode.McpStdioServerDefinition> {
  private readonly changed = new vscode.EventEmitter<void>();

  /** Re-offer the server when the governing specification changes unit. */
  readonly onDidChangeMcpServerDefinitions = this.changed.event;

  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(
      this.changed,
      getSpecService().onDidChangeSpec(() => this.changed.fire())
    );
  }

  provideMcpServerDefinitions(): vscode.McpStdioServerDefinition[] {
    const specUri = getSpecService().state.activeSpecUri;
    if (!specUri || specUri.scheme !== 'file') {
      // Offering a server with nowhere to look would give the agent a
      // toolchain that answers every question with "no specification found".
      return [];
    }

    // The server resolves the specification from its working directory, so the
    // unit root is what scopes it — the same directory the gate uses as its
    // baseDir, which is what keeps their answers consistent in a monorepo.
    const unitRoot = path.dirname(specUri.fsPath);

    const server = new vscode.McpStdioServerDefinition(
      SERVER_LABEL,
      'npx',
      ['-y', MCP_SERVER_SPEC],
      {},
      MCP_SERVER_SPEC
    );
    server.cwd = vscode.Uri.file(unitRoot);

    log.info('MCP', `offering the RQML server for ${unitRoot}`);
    return [server];
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}

/**
 * Register the provider, if this VS Code supports it.
 *
 * Guarded rather than assumed: the API is stable at 1.101 and the manifest
 * requires 1.108, so it should always be present — but an absent API should
 * cost the user a log line, not a failed activation.
 */
export function registerMcpProvider(context: vscode.ExtensionContext): void {
  if (typeof vscode.lm?.registerMcpServerDefinitionProvider !== 'function') {
    log.info('MCP', 'this VS Code build cannot register MCP servers; skipping');
    return;
  }

  const provider = new RqmlMcpProvider();
  context.subscriptions.push(
    provider,
    vscode.lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, provider)
  );
  log.info('MCP', `registered the RQML server provider (${MCP_SERVER_SPEC})`);
}
