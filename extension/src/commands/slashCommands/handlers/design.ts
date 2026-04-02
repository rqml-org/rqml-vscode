// REQ-CMD-016: Design decision command
// REQ-CMD-017: ADR file management
// REQ-CMD-018: ADR lifecycle management

import * as vscode from 'vscode';
import type { SlashCommand, ParsedCommand, CommandContext } from '../types';

const ADR_DIR = '.rqml/adr';

const CLASSIFICATION_MODEL =
  'You MUST classify every design issue using exactly one of these categories:\n' +
  '- **required_by_spec**: directly mandated by core RQML/spec rules\n' +
  '- **derived_from_requirements**: not explicitly mandated, but effectively forced by requirements/constraints\n' +
  '- **discretionary_design_choice**: real design choice with alternatives\n' +
  '- **implementation_detail**: too low-level for ADR\n\n' +
  'Only the first three classifications may lead to an ADR. implementation_detail should NOT create one.\n';

const ADR_WORTHINESS =
  'A decision is ADR-worthy when at least some of these are true:\n' +
  '- there are multiple plausible options\n' +
  '- the choice affects architecture, workflow, or extension behavior\n' +
  '- the choice is likely to matter later or constrains future work\n' +
  '- the choice affects more than one component\n' +
  '- the choice is not already trivially mandated by existing rules\n\n' +
  'If a topic is NOT ADR-worthy, help reason about it but explicitly state that no ADR is created.\n';

const ADR_TEMPLATE =
  '# ADR-NNNN: Short decision title\n\n' +
  '- Status: Accepted\n' +
  '- Date: YYYY-MM-DD\n' +
  '- Classification: discretionary_design_choice\n' +
  '- Related requirements: REQ-XXX\n' +
  '- Related ADRs: None\n' +
  '- Affected components: component1, component2\n\n' +
  '## Context\n\nDescribe the design problem, background, and why this decision is needed.\n\n' +
  '## Decision drivers\n\n- requirement constraints\n- UX goals\n- maintainability\n- implementation simplicity\n- consistency with RQML principles\n\n' +
  '## Options considered\n\n### Option 1: <name>\nDescription.\n\n**Pros**\n- ...\n\n**Cons**\n- ...\n\n### Option 2: <name>\nDescription.\n\n**Pros**\n- ...\n\n**Cons**\n- ...\n\n' +
  '## Decision\n\nState the chosen option clearly and directly.\n\n' +
  '## Consequences\n\n### Positive\n- ...\n\n### Negative\n- ...\n\n' +
  '## Supersession\nNone\n';

const FORMAT_INSTRUCTIONS =
  'Structure your ADR output as clean Markdown following this template exactly:\n\n' +
  '```\n' + ADR_TEMPLATE + '```\n\n' +
  'Replace NNNN with the actual ADR number, YYYY-MM-DD with today\'s date, and fill all sections.\n' +
  'Do NOT wrap the ADR in a code fence — output the ADR content directly.\n' +
  'Do NOT add conversational preamble before the ADR content.\n';

// ── ADR file helpers ──────────────────────────────────────────────────

function getAdrDirUri(): vscode.Uri | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return null;
  return vscode.Uri.joinPath(folders[0].uri, ADR_DIR);
}

async function ensureAdrDir(): Promise<vscode.Uri | null> {
  const dirUri = getAdrDirUri();
  if (!dirUri) return null;
  try {
    await vscode.workspace.fs.stat(dirUri);
  } catch {
    await vscode.workspace.fs.createDirectory(dirUri);
  }
  return dirUri;
}

async function listAdrFiles(): Promise<{ name: string; uri: vscode.Uri }[]> {
  const dirUri = getAdrDirUri();
  if (!dirUri) return [];
  try {
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    return entries
      .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'))
      .map(([name]) => ({ name, uri: vscode.Uri.joinPath(dirUri, name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function readAdrFile(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString('utf-8');
}

async function getNextAdrNumber(): Promise<number> {
  const files = await listAdrFiles();
  let max = 0;
  for (const f of files) {
    const match = f.name.match(/^(\d+)-/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

function stripProposalBlocks(text: string): string {
  return text.replace(/:::CHANGE_PROPOSAL:::[\s\S]*?:::END_PROPOSAL:::/g, '').trim();
}

async function writeAdrFile(number: number, slug: string, content: string): Promise<string> {
  const dirUri = await ensureAdrDir();
  if (!dirUri) throw new Error('No workspace folder open');
  const padded = String(number).padStart(4, '0');
  const filename = `${padded}-${slug}.md`;
  const fileUri = vscode.Uri.joinPath(dirUri, filename);
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
  return `${ADR_DIR}/${filename}`;
}

/**
 * Extract a kebab-case slug from an ADR title line like "# ADR-0001: Some Title Here"
 */
function extractSlug(content: string): string {
  const titleMatch = content.match(/^#\s+ADR-\d+:\s*(.+)/m);
  const title = titleMatch ? titleMatch[1] : 'untitled';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
}

// ── Prompt builders ───────────────────────────────────────────────────

function buildNewPrompt(topic: string, nextNumber: number, existingAdrs: string): string {
  let prompt =
    '[SYSTEM] You are helping the user make an architectural design decision.\n\n' +
    CLASSIFICATION_MODEL +
    ADR_WORTHINESS +
    `The next ADR number is ${String(nextNumber).padStart(4, '0')}.\n\n` +
    'Steps:\n' +
    '1. Classify the decision\n' +
    '2. Assess ADR-worthiness\n' +
    '3. If ADR-worthy: explore options with pros/cons, recommend a decision, and output the ADR\n' +
    '4. If NOT ADR-worthy: reason about it and state that no ADR is created\n\n' +
    FORMAT_INSTRUCTIONS +
    `\nThe user wants to decide about: ${topic}\n`;

  if (existingAdrs) {
    prompt += '\n[EXISTING ADRs]\n' + existingAdrs + '\n';
  }

  return prompt;
}

function buildReviewPrompt(adrContent: string, adrFilename: string): string {
  return (
    '[SYSTEM] Review the following ADR in light of current requirements and implementation state.\n' +
    'Analyse whether the decision still holds, needs updating, or should be superseded.\n' +
    'If supersession is warranted, explain why and propose a new ADR.\n' +
    CLASSIFICATION_MODEL +
    `\n[ADR: ${adrFilename}]\n${adrContent}\n`
  );
}

function buildDecidePrompt(adrContent: string, adrFilename: string): string {
  return (
    '[SYSTEM] The user wants to finalize this proposed ADR.\n' +
    'Review it, ensure all sections are complete, set status to Accepted, and output the finalized ADR.\n' +
    FORMAT_INSTRUCTIONS +
    `\n[PROPOSED ADR: ${adrFilename}]\n${adrContent}\n`
  );
}

function buildOverviewPrompt(allAdrs: string): string {
  return (
    '[SYSTEM] Summarize the current architecture and key design decisions based on the ADR set below.\n' +
    'Group by affected area/component. Highlight active decisions (Accepted) and note any that are ' +
    'Superseded or Deprecated. Be concise but comprehensive.\n\n' +
    '[ADRs]\n' + allAdrs + '\n'
  );
}

// ── Command definition ────────────────────────────────────────────────

export function createDesignCommands(): SlashCommand[] {
  const designCommand: SlashCommand = {
    name: 'design',
    description: 'Explore and document architectural design decisions as ADRs',
    usage: '/design [new|review|decide|overview|list] [<topic | ADR-ID>]',
    category: 'planning',
    requiresLlm: true,
    requiresSpec: false,
    subcommands: [
      { name: 'new', description: 'Start a new design decision' },
      { name: 'review', description: 'Review an existing ADR' },
      { name: 'decide', description: 'Finalize a proposed ADR' },
      { name: 'overview', description: 'Summarize architecture from ADR set' },
      { name: 'list', description: 'List existing ADRs and statuses' },
    ],

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const sub = parsed.subcommand || '';
      const topic = parsed.args.join(' ');

      switch (sub) {
        case 'list':
          await handleList(ctx);
          break;
        case 'overview':
          await handleOverview(ctx);
          break;
        case 'review':
          await handleReview(topic, ctx);
          break;
        case 'decide':
          await handleDecide(topic, ctx);
          break;
        case 'new':
          await handleNew(topic, ctx);
          break;
        default:
          // No subcommand — infer intent from context
          await handleInfer(topic, ctx);
          break;
      }
    },
  };

  return [designCommand];
}

// ── Subcommand handlers ───────────────────────────────────────────────

async function handleList(ctx: CommandContext): Promise<void> {
  const files = await listAdrFiles();
  if (files.length === 0) {
    ctx.reply('No ADRs found. Use `/design new <topic>` to create one.');
    return;
  }

  const lines: string[] = ['**Architecture Decision Records**', ''];
  for (const f of files) {
    const content = await readAdrFile(f.uri);
    const statusMatch = content.match(/^-\s*Status:\s*(.+)/m);
    const classMatch = content.match(/^-\s*Classification:\s*(.+)/m);
    const dateMatch = content.match(/^-\s*Date:\s*(.+)/m);
    const titleMatch = content.match(/^#\s+(.+)/m);

    const status = statusMatch?.[1]?.trim() || 'Unknown';
    const classification = classMatch?.[1]?.trim() || '';
    const date = dateMatch?.[1]?.trim() || '';
    const title = titleMatch?.[1]?.trim() || f.name;

    const classTag = classification ? ` · ${classification}` : '';
    lines.push(`- **${title}** — ${status}${classTag} (${date})`);
  }

  ctx.reply(lines.join('\n'));
}

async function handleOverview(ctx: CommandContext): Promise<void> {
  const files = await listAdrFiles();
  if (files.length === 0) {
    ctx.reply('No ADRs found. Use `/design new <topic>` to create the first one.');
    return;
  }

  const allContent: string[] = [];
  for (const f of files) {
    const content = await readAdrFile(f.uri);
    allContent.push(`--- ${f.name} ---\n${content}`);
  }

  await ctx.streamPrompt(buildOverviewPrompt(allContent.join('\n\n')));
}

async function handleReview(topic: string, ctx: CommandContext): Promise<void> {
  if (!topic) {
    ctx.reply('Usage: `/design review <ADR number or topic>`');
    return;
  }

  const file = await findAdr(topic);
  if (!file) {
    ctx.reply(`No ADR found matching "${topic}". Use \`/design list\` to see existing ADRs.`);
    return;
  }

  const content = await readAdrFile(file.uri);
  await ctx.streamPrompt(buildReviewPrompt(content, file.name));
}

async function handleDecide(topic: string, ctx: CommandContext): Promise<void> {
  if (!topic) {
    ctx.reply('Usage: `/design decide <ADR number or topic>`');
    return;
  }

  const file = await findAdr(topic);
  if (!file) {
    ctx.reply(`No ADR found matching "${topic}". Use \`/design list\` to see existing ADRs.`);
    return;
  }

  const content = await readAdrFile(file.uri);

  // Check if it's actually in Proposed status
  const statusMatch = content.match(/^-\s*Status:\s*(.+)/m);
  const status = statusMatch?.[1]?.trim();
  if (status === 'Accepted') {
    ctx.reply(`**${file.name}** is already Accepted.`);
    return;
  }

  await ctx.streamPrompt(buildDecidePrompt(content, file.name));

  // Persist the finalized ADR
  const streamed = ctx.services.agent.getLastStreamContent();
  if (streamed) {
    const cleaned = stripProposalBlocks(streamed);
    await vscode.workspace.fs.writeFile(file.uri, Buffer.from(cleaned, 'utf-8'));
    ctx.system(`ADR finalized: \`${ADR_DIR}/${file.name}\``);
  }
}

async function handleNew(topic: string, ctx: CommandContext): Promise<void> {
  if (!topic) {
    ctx.reply('Usage: `/design new <topic or question>`\n\nDescribe the design decision you need to make.');
    return;
  }

  const nextNumber = await getNextAdrNumber();

  // Build existing ADR summaries for context
  const files = await listAdrFiles();
  let existingAdrs = '';
  if (files.length > 0) {
    const summaries: string[] = [];
    for (const f of files) {
      const content = await readAdrFile(f.uri);
      const titleMatch = content.match(/^#\s+(.+)/m);
      const statusMatch = content.match(/^-\s*Status:\s*(.+)/m);
      summaries.push(`- ${titleMatch?.[1] || f.name} (${statusMatch?.[1]?.trim() || 'Unknown'})`);
    }
    existingAdrs = summaries.join('\n');
  }

  await ctx.streamPrompt(buildNewPrompt(topic, nextNumber, existingAdrs));

  // Check if the LLM produced an ADR (starts with "# ADR-")
  const streamed = ctx.services.agent.getLastStreamContent();
  if (streamed) {
    const cleaned = stripProposalBlocks(streamed);
    if (cleaned.match(/^#\s+ADR-\d+/m)) {
      const slug = extractSlug(cleaned);
      const path = await writeAdrFile(nextNumber, slug, cleaned);
      ctx.system(`ADR saved to \`${path}\``);
    }
  }
}

async function handleInfer(topic: string, ctx: CommandContext): Promise<void> {
  const files = await listAdrFiles();

  if (!topic && files.length === 0) {
    // No ADRs, no topic — explain the command
    ctx.reply(
      '**`/design` — Architectural Design Decisions**\n\n' +
      'This command helps you make and record design decisions as ADRs.\n\n' +
      '**Modes:**\n' +
      '- `/design new <topic>` — Start a new design decision\n' +
      '- `/design review <ADR>` — Revisit an existing ADR\n' +
      '- `/design decide <ADR>` — Finalize a proposed ADR\n' +
      '- `/design overview` — Summarize architecture from ADRs\n' +
      '- `/design list` — List existing ADRs\n\n' +
      'Try `/design new <your design question>` to get started.'
    );
    return;
  }

  if (!topic && files.length > 0) {
    // Has ADRs but no topic — show overview
    await handleOverview(ctx);
    return;
  }

  // Has a topic — treat as /design new
  await handleNew(topic, ctx);
}

// ── ADR lookup helper ─────────────────────────────────────────────────

async function findAdr(query: string): Promise<{ name: string; uri: vscode.Uri } | null> {
  const files = await listAdrFiles();
  if (files.length === 0) return null;

  // Try matching by ADR number (e.g., "1", "0001", "ADR-0001")
  const numMatch = query.match(/(?:ADR-)?(\d+)/i);
  if (numMatch) {
    const padded = numMatch[1].padStart(4, '0');
    const found = files.find(f => f.name.startsWith(padded + '-'));
    if (found) return found;
  }

  // Try matching by keyword in filename
  const lower = query.toLowerCase();
  const found = files.find(f => f.name.toLowerCase().includes(lower));
  return found || null;
}
