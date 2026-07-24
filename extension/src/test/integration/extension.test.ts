// Tests that need a real extension host. Everything that does not is in
// ../unit and runs under vitest in about a second.
//
// The point of these is narrow: prove the extension activates, and that what it
// declares actually exists. A command contributed in package.json but never
// registered is invisible until a user clicks it and gets "command not found" —
// the class of defect that shipped a dead activation event and a "coming soon"
// command to the Marketplace.

import * as assert from 'assert';
import * as vscode from 'vscode';

const EXTENSION_ID = 'rqml.rqml-vscode';

suite('Extension', () => {
  test('is installed', () => {
    assert.ok(vscode.extensions.getExtension(EXTENSION_ID), `${EXTENSION_ID} not found`);
  });

  test('activates without error', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    await ext.activate();
    assert.strictEqual(ext.isActive, true);
  });

  test('registers every command it contributes', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    await ext.activate();

    const contributed: string[] = (ext.packageJSON.contributes?.commands ?? []).map(
      (c: { command: string }) => c.command
    );
    assert.ok(contributed.length > 0, 'no commands contributed');

    const registered = new Set(await vscode.commands.getCommands(true));
    const missing = contributed.filter((c) => !registered.has(c));
    assert.deepStrictEqual(missing, [], `contributed but not registered: ${missing.join(', ')}`);
  });

  test('every activation event names a view or command that exists', () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    const pkg = ext.packageJSON;

    const viewIds = new Set<string>(
      (Object.values(pkg.contributes?.views ?? {}) as { id: string }[][])
        .flat()
        .map((v) => v.id)
    );
    const commandIds = new Set<string>(
      (pkg.contributes?.commands ?? []).map((c: { command: string }) => c.command)
    );

    // A typo here is silent: the event never fires, so the view never activates
    // on demand and the failure looks like a performance problem.
    const dangling: string[] = [];
    for (const event of (pkg.activationEvents ?? []) as string[]) {
      if (event.startsWith('onView:') && !viewIds.has(event.slice('onView:'.length))) {
        dangling.push(event);
      }
      if (event.startsWith('onCommand:') && !commandIds.has(event.slice('onCommand:'.length))) {
        dangling.push(event);
      }
    }
    assert.deepStrictEqual(dangling, [], `activation events with no target: ${dangling.join(', ')}`);
  });

  test('contributes the rqml language and a grammar for it', () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    const pkg = ext.packageJSON;

    const languages: { id: string; extensions?: string[] }[] = pkg.contributes?.languages ?? [];
    const rqml = languages.find((l) => l.id === 'rqml');
    assert.ok(rqml, 'no rqml language contribution');
    assert.ok(rqml.extensions?.includes('.rqml'), '.rqml not associated with the rqml language');

    const grammars: { language: string }[] = pkg.contributes?.grammars ?? [];
    assert.ok(
      grammars.some((g) => g.language === 'rqml'),
      'no grammar for the rqml language'
    );
  });

  test('opens a document in the rqml language mode', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'rqml',
      content: '<rqml version="2.2.0"></rqml>',
    });
    assert.strictEqual(doc.languageId, 'rqml');
  });

  test('registers every language model tool it contributes', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    await ext.activate();

    const contributed: string[] = (ext.packageJSON.contributes?.languageModelTools ?? []).map(
      (t: { name: string }) => t.name
    );
    assert.ok(contributed.length > 0, 'no language model tools contributed');

    // Same failure mode as an unregistered command: the manifest advertises a
    // tool to the agent, and invoking it finds nothing behind it.
    const registered = new Set(vscode.lm.tools.map((t) => t.name));
    const missing = contributed.filter((name) => !registered.has(name));
    assert.deepStrictEqual(missing, [], `contributed but not registered: ${missing.join(', ')}`);
  });

  test('every contributed tool carries the fields agent mode requires', () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    const tools: {
      name: string;
      displayName?: string;
      modelDescription?: string;
      canBeReferencedInPrompt?: boolean;
      toolReferenceName?: string;
    }[] = ext.packageJSON.contributes?.languageModelTools ?? [];

    for (const tool of tools) {
      // name / displayName / modelDescription are required by the contribution
      // schema; a tool missing them fails to load with no obvious symptom.
      assert.ok(tool.displayName, `${tool.name} has no displayName`);
      assert.ok(tool.modelDescription, `${tool.name} has no modelDescription`);
      // A tool without both of these is invisible to agent mode entirely, which
      // is the whole point of contributing it.
      assert.strictEqual(tool.canBeReferencedInPrompt, true, `${tool.name} is not agent-visible`);
      assert.ok(tool.toolReferenceName, `${tool.name} has no toolReferenceName`);
    }
  });

  test('contributes an MCP server provider whose id matches the registration', () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    const providers: { id: string }[] =
      ext.packageJSON.contributes?.mcpServerDefinitionProviders ?? [];

    assert.strictEqual(providers.length, 1, 'expected exactly one MCP server provider');
    // The manifest id and the id passed to registerMcpServerDefinitionProvider
    // must match, or the server silently never appears.
    assert.strictEqual(providers[0].id, 'rqml');
  });
});
