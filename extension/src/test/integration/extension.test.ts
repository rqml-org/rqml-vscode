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
});
