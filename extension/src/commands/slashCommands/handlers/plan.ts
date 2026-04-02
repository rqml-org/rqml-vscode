// REQ-CMD-009: Implementation planning command
// Persists the plan to .rqml/plan.md

import * as vscode from 'vscode';
import type { SlashCommand, ParsedCommand, CommandContext } from '../types';

const PLAN_DIR = '.rqml';
const PLAN_FILE = 'plan.md';
const PLAN_REL_PATH = `${PLAN_DIR}/${PLAN_FILE}`;

const AGENT_CONTEXT =
  'The implementation will be carried out by AI coding agents (e.g. Claude Code, Codex CLI, Copilot). ' +
  'Do NOT estimate human time/weeks. Instead, frame each stage as a self-contained agent task: ' +
  'what the agent should do, which files/modules it should touch, what inputs it needs (spec sections, existing code), ' +
  'and how to verify the output (tests, build, lint). ';

const FORMAT_INSTRUCTIONS =
  'Structure your output as a clean Markdown document suitable for saving to a file. ' +
  'Use headings (##) for stages, bullet lists for details, and checkboxes (- [ ] / - [x]) for completion status. ' +
  'Do NOT wrap the plan in a code fence or add conversational preamble — output the plan content directly.';

// ── File helpers ──────────────────────────────────────────────────────

async function writePlanFile(content: string): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return;
  const root = folders[0].uri;
  const dirUri = vscode.Uri.joinPath(root, PLAN_DIR);
  try {
    await vscode.workspace.fs.stat(dirUri);
  } catch {
    await vscode.workspace.fs.createDirectory(dirUri);
  }
  const fileUri = vscode.Uri.joinPath(root, PLAN_REL_PATH);
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
}

/**
 * Strip :::CHANGE_PROPOSAL::: blocks so the plan file is clean markdown.
 */
function stripProposalBlocks(text: string): string {
  return text.replace(/:::CHANGE_PROPOSAL:::[\s\S]*?:::END_PROPOSAL:::/g, '').trim();
}

// ── Prompt builders ───────────────────────────────────────────────────

/**
 * Build a prompt to generate or regenerate a plan.
 */
function buildPlanPrompt(
  target: string,
  isFull: boolean,
  existingPlan: string | null
): string {
  let prompt: string;

  if (isFull) {
    if (target) {
      prompt =
        `[SYSTEM] Generate a detailed, staged implementation plan for: ${target}. ` +
        AGENT_CONTEXT +
        'For each stage include: goal, input requirements (by ID), files to create or modify, ' +
        'acceptance criteria to satisfy, verification commands, and trace expectations. ' +
        'Start with a readiness verdict (READY / NOT READY) and list any blockers. ';
    } else {
      prompt =
        '[SYSTEM] Generate a detailed, staged implementation plan for all unimplemented requirements in the spec. ' +
        AGENT_CONTEXT +
        'Group by package or feature area. For each stage include: goal, input requirements (by ID), ' +
        'files to create or modify, acceptance criteria, verification commands, and trace expectations. ' +
        'Start with a readiness verdict (READY / NOT READY) and list any blockers. ';
    }
  } else {
    if (target) {
      prompt =
        `[SYSTEM] Give a concise implementation overview for: ${target}. ` +
        AGENT_CONTEXT +
        'List the stages in order, one line per stage: stage name, scope (requirement IDs), ' +
        'and key output. End with a readiness verdict (READY / NOT READY) and any blockers. ';
    } else {
      prompt =
        '[SYSTEM] Give a concise implementation overview for all unimplemented requirements in the spec. ' +
        AGENT_CONTEXT +
        'List the stages in order, one line per stage: stage name, scope (requirement IDs), ' +
        'and key output. End with a readiness verdict (READY / NOT READY) and any blockers. ';
    }
  }

  prompt += FORMAT_INSTRUCTIONS;

  if (existingPlan) {
    prompt +=
      '\n\n[EXISTING PLAN]\n' +
      'An implementation plan already exists. Review and update it: ' +
      'preserve completed stages (marked with [x]), update in-progress ones, ' +
      'and add new stages for uncovered requirements. Output the complete updated plan.\n\n' +
      existingPlan;
  }

  return prompt;
}

/**
 * Build a prompt to review an existing plan and propose the next stage.
 */
function buildReviewPrompt(existingPlan: string, target: string): string {
  let prompt =
    '[SYSTEM] Review the implementation plan below. ' +
    'Summarize which stages are complete (marked [x]), which is the next unfinished stage, and any blockers. ' +
    'Then propose implementing that next stage — briefly describe what it will involve. ' +
    'Be concise (5-10 lines). Do NOT regenerate or rewrite the plan.';

  if (target) {
    prompt += ` Focus on stages related to: ${target}.`;
  }

  prompt += '\n\n[PLAN]\n' + existingPlan;

  return prompt;
}

// ── Command definition ────────────────────────────────────────────────

export function createPlanCommands(): SlashCommand[] {
  const planCommand: SlashCommand = {
    name: 'plan',
    description: 'Review the plan and propose next steps (--full to regenerate)',
    usage: '/plan [--full] [<target>]',
    category: 'planning',
    requiresSpec: true,
    requiresLlm: true,

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const target = parsed.args.length > 0 ? parsed.args.join(' ') : '';
      const isFull = parsed.flags.has('full');

      // Read existing plan (if any)
      const existingPlan = await ctx.services.agent.readPlanFile();

      if (existingPlan && !isFull) {
        // Review mode: summarize the plan and propose the next stage
        const prompt = buildReviewPrompt(existingPlan, target);
        await ctx.streamPrompt(prompt);
        // Don't overwrite the plan file in review mode
      } else {
        // Generate / regenerate mode
        const prompt = buildPlanPrompt(target, isFull, existingPlan);
        await ctx.streamPrompt(prompt);

        // Persist the plan to .rqml/plan.md
        const content = ctx.services.agent.getLastStreamContent();
        if (content) {
          const cleaned = stripProposalBlocks(content);
          await writePlanFile(cleaned);
          ctx.system(`Plan saved to \`${PLAN_REL_PATH}\``);
        }
      }
    },
  };

  return [planCommand];
}
