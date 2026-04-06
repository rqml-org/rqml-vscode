// Agent Skills support (https://agentskills.io/)
// Discovers, parses, and manages skills from standard locations.

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export interface SkillEntry {
  name: string;
  description: string;
  /** Absolute path to the skill directory */
  skillDir: string;
  /** Absolute path to SKILL.md */
  skillMdPath: string;
  /** Where the skill was discovered from */
  source: 'user' | 'project-agents' | 'project-rqml';
}

/**
 * SkillService — Discovers and manages Agent Skills from standard locations.
 *
 * Discovery order (later overrides earlier by name):
 * 1. ~/.agents/skills/        — user-level cross-client
 * 2. <workspace>/.agents/skills/ — project-level cross-client
 * 3. <workspace>/.rqml/skills/   — RQML-specific project skills
 */
export class SkillService {
  private _catalog = new Map<string, SkillEntry>();
  private watcher?: vscode.FileSystemWatcher;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.setupWatcher();
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh())
    );
  }

  private setupWatcher(): void {
    this.watcher?.dispose();
    this.watcher = vscode.workspace.createFileSystemWatcher('**/SKILL.md');
    this.watcher.onDidCreate(() => this.refresh());
    this.watcher.onDidDelete(() => this.refresh());
    this.watcher.onDidChange(() => this.refresh());
    this.disposables.push(this.watcher);
  }

  /** Get the current skill catalog. */
  getCatalog(): SkillEntry[] {
    return Array.from(this._catalog.values());
  }

  /** Get a skill by name. */
  getSkill(name: string): SkillEntry | undefined {
    return this._catalog.get(name);
  }

  /** Read the full content of a skill's SKILL.md. */
  async getSkillContent(name: string): Promise<string | null> {
    const entry = this._catalog.get(name);
    if (!entry) return null;
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(entry.skillMdPath));
      return Buffer.from(bytes).toString('utf-8');
    } catch {
      return null;
    }
  }

  /** Scan all discovery directories and rebuild the catalog. */
  async refresh(): Promise<void> {
    const catalog = new Map<string, SkillEntry>();

    // 1. User-level: ~/.agents/skills/
    const userDir = path.join(os.homedir(), '.agents', 'skills');
    await this.scanDirectory(userDir, 'user', catalog);

    // 2. Project-level: <workspace>/.agents/skills/
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      await this.scanDirectory(
        path.join(workspaceRoot, '.agents', 'skills'),
        'project-agents',
        catalog
      );

      // 3. RQML-specific: <workspace>/.rqml/skills/
      await this.scanDirectory(
        path.join(workspaceRoot, '.rqml', 'skills'),
        'project-rqml',
        catalog
      );
    }

    this._catalog = catalog;
  }

  /**
   * Scan a directory for skill subdirectories containing SKILL.md.
   * Later sources override earlier ones by name.
   */
  private async scanDirectory(
    dirPath: string,
    source: SkillEntry['source'],
    catalog: Map<string, SkillEntry>
  ): Promise<void> {
    const dirUri = vscode.Uri.file(dirPath);
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dirUri);
    } catch {
      return; // Directory doesn't exist
    }

    for (const [name, type] of entries) {
      if (type !== vscode.FileType.Directory) continue;

      const skillMdPath = path.join(dirPath, name, 'SKILL.md');
      try {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(skillMdPath));
        const content = Buffer.from(bytes).toString('utf-8');
        const parsed = this.parseFrontmatter(content);

        if (parsed.name && parsed.description) {
          catalog.set(parsed.name, {
            name: parsed.name,
            description: parsed.description,
            skillDir: path.join(dirPath, name),
            skillMdPath,
            source,
          });
        }
      } catch {
        // No SKILL.md or unreadable — skip
      }
    }
  }

  /**
   * Parse YAML frontmatter from SKILL.md content.
   * Extracts name and description from the --- delimited block.
   */
  private parseFrontmatter(content: string): { name?: string; description?: string } {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return {};

    const yaml = match[1];
    const name = yaml.match(/^name:\s*(.+)/m)?.[1]?.trim();
    const description = yaml.match(/^description:\s*(.+)/m)?.[1]?.trim();
    return { name, description };
  }

  dispose(): void {
    this.watcher?.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}

/** Singleton instance */
let skillServiceInstance: SkillService | undefined;

export function getSkillService(): SkillService {
  if (!skillServiceInstance) {
    skillServiceInstance = new SkillService();
  }
  return skillServiceInstance;
}
